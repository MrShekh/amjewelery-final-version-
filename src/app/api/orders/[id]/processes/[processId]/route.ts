import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getManufacturingProcessesCollection, getInventoryCollection, getUsersCollection, getGoldTransactionsCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

// DELETE /api/orders/[id]/processes/[processId] - Delete a manufacturing process and restore stock
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, processId: string }> }
) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({ 
      _id: new ObjectId(payload.userId),
      isActive: true 
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Verify email matches token
    if (user.email !== payload.email) {
      return NextResponse.json({ error: 'Token validation failed' }, { status: 401 })
    }

    const { id: orderId, processId } = await params
    
    if (!ObjectId.isValid(orderId) || !ObjectId.isValid(processId)) {
      return NextResponse.json(
        { error: 'Invalid order ID or process ID' },
        { status: 400 }
      )
    }
    
    const ordersCol = await getOrdersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const inventoryCol = await getInventoryCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    
    // Check if order exists
    const existingOrder = await ordersCol.findOne({ _id: new ObjectId(orderId) })
    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    
    // Check if process exists
    const existingProcess = await processesCol.findOne({ 
      _id: new ObjectId(processId),
      orderId: orderId 
    })
    if (!existingProcess) {
      return NextResponse.json(
        { error: 'Process not found' },
        { status: 404 }
      )
    }
    
    // Check if order can have processes deleted (not delivered)
    if (existingOrder.status === 'DELIVERED') {
      return NextResponse.json(
        { error: 'Cannot delete processes from delivered orders' },
        { status: 400 }
      )
    }
    
    // If this process had a recorded loss, revert it in inventory: move loss back from karigarLossStock to adminStock
    const inventory = await inventoryCol.findOne({})
    if (inventory && existingProcess.goldLoss && existingProcess.goldLoss > 0) {
      const lossAmount = existingProcess.goldLoss
      await inventoryCol.updateOne(
        { _id: inventory._id },
        {
          $inc: {
            adminStock: lossAmount,
            karigarLossStock: -lossAmount
          },
          $set: { lastUpdated: new Date() }
        }
      )
    }

    // Remove any GOLD_LOSS transactions associated with this process (by order + processType text match)
    const lossTransactionFilter = {
      orderId: orderId,
      type: 'GOLD_LOSS',
      description: { $regex: existingProcess.processType }
    }
    
    const deletedLossTransactions = await transactionsCol.deleteMany(lossTransactionFilter)
    console.log(`Removed ${deletedLossTransactions.deletedCount} GOLD_LOSS transaction(s) for ${existingProcess.processType} process`)
    
    // Delete the process
    await processesCol.deleteOne({ _id: new ObjectId(processId) })
    
    // Recalculate sequences for remaining processes
    const remainingProcesses = await processesCol.find({ orderId: orderId }).sort({ sequence: 1 }).toArray()
    for (let i = 0; i < remainingProcesses.length; i++) {
      await processesCol.updateOne(
        { _id: remainingProcesses[i]._id },
        { $set: { sequence: i + 1 } }
      )
    }
    
    // Get updated remaining processes after deletion
    const finalRemainingProcesses = await processesCol.find({ orderId: orderId }).sort({ sequence: 1 }).toArray()
    
    // If no processes remain and order was IN_PROCESS, change status back to CREATED
    if (finalRemainingProcesses.length === 0 && existingOrder.status === 'IN_PROCESS') {
      await ordersCol.updateOne(
        { _id: new ObjectId(orderId) },
        { $set: { status: 'CREATED' } }
      )
      console.log(`Changed order ${orderId} status back to CREATED - no processes remain`)
    }
    
    let message = `Process deleted successfully. `
    message += `Gold loss (if any) reverted to admin stock and loss transactions removed for accurate tracking.`
    
    return NextResponse.json({ 
      message,
      remainingProcesses: finalRemainingProcesses.length
    })
    
  } catch (error) {
    console.error('Error deleting process:', error)
    return NextResponse.json(
      { error: 'Failed to delete process' },
      { status: 500 }
    )
  }
}
