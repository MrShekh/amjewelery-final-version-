import { NextRequest, NextResponse } from 'next/server'
import { getKarigarsCollection, getManufacturingProcessesCollection, getInventoryCollection, getRecoveryHistoryCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { truncateToThreeDecimals, truncateJewelryNumbers } from '@/utils/numberFormat'

interface NewSimpleRecoveryRequest {
  orderIds: string[]
  karat: string
  makingCharge: number
  recoveredAmount: number
  totalLoss: number
  selectedDate?: string | null
}

interface RecoverySession {
  _id: ObjectId
  karigarId: ObjectId
  date: Date
  karat: string
  totalOrders: number
  totalLoss: number
  makingCharge: number
  recoveredAmount: number
  orderIds: ObjectId[]
  recoveredBy: string
  selectedDate?: string | null
  createdAt: Date
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: karigarId } = await params
    
    // Validate karigarId format
    if (!ObjectId.isValid(karigarId)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID format' },
        { status: 400 }
      )
    }

    // Verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body: NewSimpleRecoveryRequest = await request.json()
    const { orderIds, karat, makingCharge, recoveredAmount, totalLoss, selectedDate } = body

    // Validate inputs
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: 'Order IDs are required' },
        { status: 400 }
      )
    }

    if (!karat) {
      return NextResponse.json(
        { error: 'Karat type is required' },
        { status: 400 }
      )
    }

    if (makingCharge < 0 || recoveredAmount < 0 || totalLoss < 0) {
      return NextResponse.json(
        { error: 'Amounts cannot be negative' },
        { status: 400 }
      )
    }

    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const inventoryCol = await getInventoryCollection()
    const recoveryHistoryCol = await getRecoveryHistoryCollection()
    
    // Get karigar details
    const karigar = await karigarsCol.findOne(
      { _id: new ObjectId(karigarId) },
      { projection: { name: 1, recoveryHistory: 1 } }
    )

    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }

    console.log('🔄 Starting recovery process for orders:', orderIds)
    console.log('💰 Making charge:', makingCharge, 'Recovered amount:', recoveredAmount)

    const currentDate = new Date()
    const recoverySessionId = new ObjectId()

    // Convert order IDs to ObjectIds for the manufacturing processes
    const objectIdOrderIds = orderIds.map(id => new ObjectId(id))

    // Get order details to calculate proportional distribution
    const ordersToUpdate = await processesCol.find({
      _id: { $in: objectIdOrderIds },
      karigarId: karigarId
    }).toArray()
    
    if (ordersToUpdate.length === 0) {
      return NextResponse.json(
        { error: 'No matching orders found for recovery' },
        { status: 404 }
      )
    }
    
    // Calculate proportional making charge and recovery per order based on loss
    const totalOrderLoss = ordersToUpdate.reduce((sum, order) => sum + (order.goldLoss || 0), 0)
    
    console.log('📊 Order distribution calculation:', {
      totalOrderLoss,
      makingChargeTotal: makingCharge,
      recoveredAmountTotal: recoveredAmount,
      orderCount: ordersToUpdate.length
    })
    
    // Update each order individually with proportional amounts
    const updatePromises = ordersToUpdate.map(async (order) => {
      const orderLoss = order.goldLoss || 0
      const lossRatio = totalOrderLoss > 0 ? orderLoss / totalOrderLoss : 1 / ordersToUpdate.length
      
      const orderMakingCharge = truncateToThreeDecimals(makingCharge * lossRatio)
      const orderRecoveredAmount = truncateToThreeDecimals(recoveredAmount * lossRatio)
      
      // Calculate if this order is fully recovered with truncated values - ALWAYS mark as fully recovered in this recovery flow
      const adminRecoverable = truncateToThreeDecimals(Math.max(0, orderLoss - orderMakingCharge))
      const isFullyRecovered = true
      
      console.log(`📋 Order ${order._id} update:`, {
        orderLoss,
        lossRatio,
        orderMakingCharge,
        orderRecoveredAmount,
        adminRecoverable,
        isFullyRecovered
      })
      
      return await processesCol.updateOne(
        { _id: order._id },
        {
          $set: {
            karigarMakingCharge: truncateToThreeDecimals(orderMakingCharge),
            goldRecovered: truncateToThreeDecimals(orderRecoveredAmount),
            isFullyRecovered: isFullyRecovered,
            adminRecoverable: truncateToThreeDecimals(adminRecoverable),
            goldRecoveredBy: payload.userId,
            recoveredAt: currentDate,
            updatedAt: currentDate
          }
        }
      )
    })
    
    const updateResults = await Promise.all(updatePromises)
    const totalModified = updateResults.reduce((sum, result) => sum + result.modifiedCount, 0)
    
    console.log('📊 Individual update results:', updateResults)
    console.log('✅ Total modified orders:', totalModified)

    // Calculate total loss of processes being recovered
    const totalProcessLoss = truncateToThreeDecimals(ordersToUpdate.reduce((sum, order) => sum + (order.goldLoss || 0), 0))

    // Update stocks using simplified model: move from karigar loss stock into recovered stock.
    // Decrement karigarLossStock by the full totalProcessLoss and increment recoveredStock by actual recoveredAmount
    const inventoryUpdate = await inventoryCol.updateOne(
      {}, // Assuming single inventory document
      {
        $inc: {
          karigarLossStock: -truncateToThreeDecimals(totalProcessLoss),
          recoveredStock: truncateToThreeDecimals(recoveredAmount)
        },
        $set: {
          lastUpdated: currentDate
        }
      },
      { upsert: true } // Create if doesn't exist
    )

    console.log('📦 Inventory update result (karigarLossStock → recoveredStock):', inventoryUpdate)

    // Calculate recovery statistics for history (pure grams, no fine-gold conversion)
    const remainingBalance = truncateToThreeDecimals(Math.max(0, totalProcessLoss - makingCharge - recoveredAmount))

    // Save recovery history record with simple gram-based values
    const dateDescription = selectedDate ? ` for orders processed on ${new Date(selectedDate).toLocaleDateString()}` : ''
    const recoveryHistoryRecord = {
      karigarId,
      karigarName: karigar.name,
      totalRecoveryAmount: truncateToThreeDecimals(makingCharge + recoveredAmount),
      makingCharge: truncateToThreeDecimals(makingCharge),
      actualRecoveryAmount: truncateToThreeDecimals(recoveredAmount),
      remainingBalance,
      karatLabel: karat,
      recoveryType: selectedDate ? 'DATE_SPECIFIC_RECOVERY' : 'SIMPLE_KARAT_RECOVERY',
      description: `Simple ${karat} recovery from manufacturing losses${dateDescription}`,
      processesAffected: ordersToUpdate.length,
      totalLossBeforeRecovery: totalProcessLoss,
      totalRecoveredBeforeThis: truncateToThreeDecimals(0), // TODO: Calculate this properly if needed
      selectedDate: selectedDate || null,
      createdAt: currentDate,
      updatedAt: currentDate
    }

    await recoveryHistoryCol.insertOne(recoveryHistoryRecord)

    // Create recovery session
    const recoverySession: RecoverySession = {
      _id: recoverySessionId,
      karigarId: new ObjectId(karigarId),
      date: currentDate,
      karat,
      totalOrders: orderIds.length,
      totalLoss,
      makingCharge,
      recoveredAmount,
      orderIds: objectIdOrderIds,
      recoveredBy: payload.userId,
      selectedDate: selectedDate || null,
      createdAt: currentDate
    }

    // Add recovery session to karigar's recovery history
    await karigarsCol.updateOne(
      { _id: new ObjectId(karigarId) },
      {
        $push: { 
          recoveryHistory: recoverySession as any
        },
        $set: {
          lastUpdated: currentDate
        }
      } as any
    )

    return NextResponse.json({
      success: true,
      message: 'Recovery completed successfully',
      session: {
        id: recoverySessionId,
        date: currentDate,
        karat,
        totalOrders: orderIds.length,
        totalLoss,
        makingCharge,
        recoveredAmount
      }
    })

  } catch (error) {
    console.error('New simple recovery error:', error)
    return NextResponse.json(
      { error: 'Failed to complete recovery' },
      { status: 500 }
    )
  }
}
