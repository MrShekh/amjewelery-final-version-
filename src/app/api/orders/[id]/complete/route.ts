import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getCustomersCollection, getManufacturingProcessesCollection, getGoldTransactionsCollection, getKarigarsCollection, getCustomerJamaBalancesCollection, getUsersCollection, getDb } from '@/lib/mongodb'
import { TransactionType, OrderStatus, toClientFormat, AdminGoldStock, AdminGoldEntry } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { karatFieldKey } from '@/lib/admin-stock-karats'
import {
  handleApiError,
  handleApiSuccess,
  AuthenticationError,
  generateRequestId
} from '@/lib/errorHandler'

// POST /api/orders/[id]/complete - Complete an order with comprehensive workflow weight adjustment
// New approach: Calculate actual final weight, update customer obligations, handle manufacturing costs
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId()

  try {
    console.log(`[${requestId}] Starting POST /api/orders/[id]/complete request`)

    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)

    if (!token) {
      throw new AuthenticationError('Authorization token required')
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
      console.log(`[${requestId}] Token verified for user:`, payload.userId)
    } catch (error) {
      console.error(`[${requestId}] Token verification failed:`, error)
      throw new AuthenticationError(error instanceof Error ? error.message : 'Invalid token')
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({
      _id: new ObjectId(payload.userId),
      isActive: true
    })

    if (!user) {
      console.error(`[${requestId}] User not found:`, payload.userId)
      throw new AuthenticationError('User not found or session expired')
    }

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    // Order completion now only tracks completion, no manufacturing cost yet
    // Manufacturing cost will be handled during bill creation

    const ordersCol = await getOrdersCollection()
    const customersCol = await getCustomersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const karigarsCol = await getKarigarsCollection()

    // Get the order with all related data
    const order = await ordersCol.findOne({ _id: new ObjectId(id) })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.DELIVERED) {
      return NextResponse.json(
        { error: 'Order is already completed' },
        { status: 400 }
      )
    }

    // Get all processes for this order
    const processes = await processesCol.find({ orderId: id }).toArray()
    const processesWithKarigar = await Promise.all(
      processes.map(async (process) => {
        const karigar = await karigarsCol.findOne({ _id: new ObjectId(process.karigarId) })
        return {
          ...process,
          karigar: karigar || null
        }
      })
    )

    // Validate that at least one process is completed
    const completedProcesses = processes.filter(p => p.status === 'COMPLETED')

    if (completedProcesses.length === 0) {
      return NextResponse.json(
        { error: 'Cannot complete order. At least one manufacturing process must be completed.' },
        { status: 400 }
      )
    }

    // Check if this is a partial completion (not all 4 processes done)
    const allProcessTypes = ['FILING', 'FREE_POLISH', 'STONE_SETTING', 'FINAL_POLISH']
    const completedProcessTypes = completedProcesses.map(p => p.processType)
    const missingProcesses = allProcessTypes.filter(type => !completedProcessTypes.includes(type))

    // Log completion details for transparency
    console.log(`[${requestId}] Order ${id} completing after processes:`, completedProcessTypes.join(', '))
    if (missingProcesses.length > 0) {
      console.log(`[${requestId}] Order ${id} completing without these processes:`, missingProcesses.join(', '))
    }

    // Get customer
    const customer = await customersCol.findOne({ _id: new ObjectId(order.customerId) })

    // Get existing transactions
    const existingTransactions = await transactionsCol.find({ orderId: id }).toArray()

    // Calculate comprehensive workflow results
    const totalGoldLoss = processes.reduce((sum, process) => sum + (process.goldLoss || 0), 0)
    const originalOrderWeight = order.originalOrderWeight || order.finalJewelryWeight

    // Get actual final weight from the chronologically last completed process
    // Sort processes by completion time (most recent first) or by sequence (highest first)
    let lastProcess = null

    if (completedProcesses.length > 0) {
      // First try to sort by completedAt timestamp if available
      const processesWithCompletedAt = completedProcesses.filter(p => p.completedAt)
      if (processesWithCompletedAt.length > 0) {
        lastProcess = processesWithCompletedAt.sort((a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        )[0]
      } else {
        // Fallback to sequence-based sorting (highest sequence number)
        lastProcess = completedProcesses.sort((a, b) => (b.sequence || 0) - (a.sequence || 0))[0]
      }
    }

    const actualFinalWeight = lastProcess ? lastProcess.outputWeight : originalOrderWeight - totalGoldLoss

    // Calculate total stone weight from all stone setting processes
    let totalStoneWeight = 0
    processes.forEach(process => {
      if (process.processType === 'STONE_SETTING') {
        const adStones = process.adStonesAdded || []
        const kalesStones = process.kalesStonesAdded || []

        adStones.forEach((stone: any) => {
          totalStoneWeight += stone.totalWeight || 0
        })

        kalesStones.forEach((stone: any) => {
          totalStoneWeight += stone.totalWeight || 0
        })
      }
    })

    // Calculate actual gold weight (final weight minus stone weights)
    const actualGoldWeight = actualFinalWeight - totalStoneWeight

    // Get karat purity for calculations
    const selectedKarat = order.selectedKarat || 92
    const karatPurity = selectedKarat / 100

    // Convert actual gold weight to fine gold for karigar return stock
    const actualGoldWeightInFineGold = actualGoldWeight * karatPurity

    const now = new Date()
    const newTransactions = []

    // Update order with completion data (NO BILLING YET)
    await ordersCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: OrderStatus.COMPLETED,
          actualFinalWeight,
          totalWeightLoss: totalGoldLoss,
          actualGoldWeight,
          totalStoneWeight,
          updatedAt: now
          // NO manufacturing cost or billing data yet - that happens during bill creation
        }
      }
    )

    // SIMPLE COMPLETION: only update order fields and track aggregated loss as a transaction
    const stockUpdates = {
      inProcessCleared: 0,
      karigarReturnStockAdded: 0,
      totalLossTracked: totalGoldLoss,
      description: [
        `Order completed. Total gold loss across processes: ${totalGoldLoss.toFixed(3)}g`
      ] as string[]
    }

    if (totalGoldLoss > 0) {
      const completionTransaction = {
        orderId: id,
        type: TransactionType.GOLD_LOSS,
        amount: totalGoldLoss,
        description: `Order ${order.orderName} completed - Total loss across processes: ${totalGoldLoss.toFixed(3)}g`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      const completionTxResult = await transactionsCol.insertOne(completionTransaction)
      newTransactions.push(await transactionsCol.findOne({ _id: completionTxResult.insertedId }))
    }

    // Update Admin Gold Stock - Automatically deduct the karat gold consumed by this order
    // The pure gold weight (without stones) used to produce this order leaves admin's
    // raw gold-on-hand for that karat, since it's now embodied in a finished piece.
    try {
      const db = await getDb()
      const adminStockCollection = db.collection<AdminGoldStock>('adminGoldStock')

      let adminStock = await adminStockCollection.findOne({})

      if (!adminStock) {
        const newStock: AdminGoldStock = {
          entries: [],
          lastUpdated: new Date(),
          createdAt: new Date()
        }

        const result = await adminStockCollection.insertOne(newStock as any)
        adminStock = { ...newStock, _id: result.insertedId }
      }

      // Create admin stock entry for this completed order (negative = gold consumed)
      const adminEntry: AdminGoldEntry = {
        _id: new ObjectId(),
        date: now,
        karat: selectedKarat,
        weight: -actualGoldWeight, // Pure gold weight without stones, leaving admin stock
        type: 'ORDER_COMPLETE',
        description: `Order ${order.orderName} completed - Pure gold weight`,
        orderId: id,
        createdAt: now
      }

      const stockField = karatFieldKey(selectedKarat)

      // Update database (no floor at zero - admin stock is allowed to go negative)
      await adminStockCollection.updateOne(
        { _id: adminStock._id },
        {
          $inc: { [stockField]: -actualGoldWeight },
          $set: { lastUpdated: now },
          $push: { entries: adminEntry as any }
        }
      )

      console.log(`[${requestId}] Admin stock updated: ${selectedKarat}K gold -${actualGoldWeight.toFixed(2)}g`)
    } catch (error) {
      console.error(`[${requestId}] Error updating admin stock:`, error)
      // Don't fail the order completion if admin stock update fails
    }


    // Get updated order with all data
    const updatedOrder = await ordersCol.findOne({ _id: new ObjectId(id) })
    const updatedOrderWithDetails = {
      ...toClientFormat(updatedOrder!),
      customer: customer ? toClientFormat(customer) : null,
      processes: processesWithKarigar.map(p => ({
        ...toClientFormat(p),
        karigar: p.karigar ? toClientFormat(p.karigar) : null
      })),
      transactions: [...existingTransactions, ...newTransactions].filter(t => t != null).map(t => toClientFormat(t!))
    }

    console.log(`[${requestId}] Order ${id} completed successfully`)

    return NextResponse.json({
      message: 'Order completed successfully with automatic weight adjustment',
      order: updatedOrderWithDetails,
      transactions: newTransactions.map(t => toClientFormat(t!)),
      stockUpdates,
      summary: {
        originalOrderWeight,
        actualFinalWeight,
        actualGoldWeight,
        totalStoneWeight,
        totalGoldLoss,
        actualGoldWeightInFineGold,
        inProcessStockCleared: stockUpdates.inProcessCleared,
        karigarReturnStockAdded: stockUpdates.karigarReturnStockAdded,
        totalLossTracked: stockUpdates.totalLossTracked,
        processesCompleted: completedProcesses.length,
        completedProcessTypes: completedProcessTypes
      }
    })
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown order completion error'), requestId)
  }
}
