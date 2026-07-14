import { NextRequest, NextResponse } from 'next/server'
import { getManufacturingProcessesCollection, getInventoryCollection, getGoldTransactionsCollection, getOrdersCollection } from '@/lib/mongodb'
import { TransactionType, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'

// POST /api/processes/[id]/recovery - Update gold recovery for a specific process
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid process ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const { recoveredGold } = body
    
    if (typeof recoveredGold !== 'number' || recoveredGold < 0) {
      return NextResponse.json(
        { error: 'Invalid recovery amount - must be 0 or greater' },
        { status: 400 }
      )
    }

    const processesCol = await getManufacturingProcessesCollection()
    const inventoryCol = await getInventoryCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    
    // Get the process
    const process = await processesCol.findOne({ _id: new ObjectId(id) })
    if (!process) {
      return NextResponse.json(
        { error: 'Process not found' },
        { status: 404 }
      )
    }

    // Get order details to determine karat purity for conversion
    const ordersCol = await getOrdersCollection()
    const order = await ordersCol.findOne({ _id: new ObjectId(process.orderId) })
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found for this process' },
        { status: 404 }
      )
    }
    
    const selectedKarat = order.selectedKarat || 92
    const karatPurity = selectedKarat / 100
    
    // Check if recovery amount is valid (not more than current net loss in karat terms)
    const currentRecoveredKarat = process.goldRecovered || 0
    const maxRecoverableKarat = process.goldLoss - currentRecoveredKarat
    
    if (recoveredGold > maxRecoverableKarat) {
      return NextResponse.json(
        { error: `Recovery amount (${recoveredGold}g karat) cannot exceed net loss (${maxRecoverableKarat.toFixed(3)}g karat)` },
        { status: 400 }
      )
    }

    const now = new Date()
    
    // Update the process with additional recovery (in karat terms)
    const newTotalRecoveredKarat = currentRecoveredKarat + recoveredGold
    await processesCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          goldRecovered: newTotalRecoveredKarat,
          updatedAt: now
        }
      }
    )
    
    // Convert recovered karat gold to fine gold for admin stock update
    const recoveredFineGold = recoveredGold * karatPurity
    
    // Update inventory - add fine gold equivalent to admin stock
    const inventory = await inventoryCol.findOne({})
    if (inventory) {
      await inventoryCol.updateOne(
        { _id: inventory._id },
        {
          $inc: {
            adminStock: recoveredFineGold // Add fine gold equivalent
          },
          $set: {
            lastUpdated: now
          }
        }
      )
    }
    
    // Create recovery transaction (record in fine gold terms for consistency)
    const recoveryTransaction = {
      orderId: process.orderId,
      type: TransactionType.GOLD_RECOVERY,
      amount: recoveredFineGold,
      description: `Gold recovery from ${process.processType} process - ${recoveredGold.toFixed(3)}g karat (${recoveredFineGold.toFixed(3)}g fine) - Process ID: ${id}`,
      recoveredGold: recoveredFineGold,
      createdAt: now,
      updatedAt: now
    }
    
    const result = await transactionsCol.insertOne(recoveryTransaction)
    const transaction = await transactionsCol.findOne({ _id: result.insertedId })

    return NextResponse.json({
      message: 'Gold recovery updated successfully',
      process: {
        ...toClientFormat(process),
        goldRecovered: newTotalRecoveredKarat
      },
      transaction: transaction ? toClientFormat(transaction) : null,
      recovery: {
        recoveredAmountKarat: recoveredGold,
        recoveredAmountFineGold: recoveredFineGold,
        karatPurity: selectedKarat
      },
      newAdminStock: inventory ? inventory.adminStock + recoveredFineGold : null
    })
    
  } catch (error) {
    console.error('Error updating process recovery:', error)
    return NextResponse.json(
      { error: 'Failed to update process recovery' },
      { status: 500 }
    )
  }
}
