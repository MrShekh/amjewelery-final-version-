import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getManufacturingProcessesCollection } from '@/lib/mongodb'
import { ProcessStatus, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
// PUT /api/orders/[id]/processes/[processId]/update-input - Update input weight of a started process
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    const { id, processId } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }
    
    if (!ObjectId.isValid(processId)) {
      return NextResponse.json(
        { error: 'Invalid process ID' },
        { status: 400 }
      )
    }
    
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { newInputWeight } = body

    // Validation
    if (newInputWeight === undefined || newInputWeight <= 0) {
      return NextResponse.json(
        { error: 'New input weight is required and must be greater than 0' },
        { status: 400 }
      )
    }

    const ordersCol = await getOrdersCollection()
    const processesCol = await getManufacturingProcessesCollection()

    // Verify order exists
    const order = await ordersCol.findOne({ _id: new ObjectId(id) })
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Find the specific process
    const process = await processesCol.findOne({ 
      _id: new ObjectId(processId),
      orderId: id 
    })

    if (!process) {
      return NextResponse.json(
        { error: 'Process not found' },
        { status: 404 }
      )
    }

    // Only allow updates for STARTED processes
    if (process.status !== ProcessStatus.STARTED) {
      return NextResponse.json(
        { error: 'Can only update input weight for processes that are currently STARTED' },
        { status: 400 }
      )
    }

    // Allow updates for all process types (simple model: just change recorded input weight)

    const oldInputWeight = process.inputWeight
    const weightDifference = newInputWeight - oldInputWeight

    const now = new Date()

    // Update the process input weight and track additional weight
    const processUpdateData: any = {
      inputWeight: newInputWeight,
      updatedAt: now
    }
    
    // Track additional weight if there was an increase
    if (weightDifference > 0) {
      processUpdateData.additionalWeight = weightDifference
      processUpdateData.originalInputWeight = oldInputWeight // Store original for reference
    }
    
    await processesCol.updateOne(
      { _id: new ObjectId(processId) },
      { $set: processUpdateData }
    )

    // Get updated process
    const updatedProcess = await processesCol.findOne({ _id: new ObjectId(processId) })

    return NextResponse.json({ 
      success: true,
      message:
        weightDifference !== 0
          ? `Process input weight updated from ${oldInputWeight.toFixed(3)}g to ${newInputWeight.toFixed(3)}g (difference: ${Math.abs(weightDifference).toFixed(3)}g)`
          : `Process input weight updated from ${oldInputWeight.toFixed(3)}g to ${newInputWeight.toFixed(3)}g`,
      process: updatedProcess,
      stockAdjustment: weightDifference !== 0
        ? {
            adjustmentAmount: Math.abs(weightDifference),
            adjustmentType: 'input_weight_change'
          }
        : null
    })

  } catch (error) {
    console.error('Error updating process input weight:', error)
    return NextResponse.json(
      { error: 'Failed to update process input weight' },
      { status: 500 }
    )
  }
}
