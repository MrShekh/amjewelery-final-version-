import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getKarigarsCollection, getManufacturingProcessesCollection, getGoldTransactionsCollection, getCustomersCollection, getInventoryCollection } from '@/lib/mongodb'
import { TransactionType, ProcessType, ProcessStatus, ProcessStep, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
// POST /api/orders/[id]/processes/complete - Complete a manufacturing process (record output)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
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

    const {
      processId,
      outputWeight
    } = body

    // Validation
    if (!processId || outputWeight === undefined || outputWeight < 0) {
      return NextResponse.json(
        { error: 'Process ID and output weight are required' },
        { status: 400 }
      )
    }

    if (!ObjectId.isValid(processId)) {
      return NextResponse.json(
        { error: 'Invalid process ID' },
        { status: 400 }
      )
    }

    const ordersCol = await getOrdersCollection()
    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const customersCol = await getCustomersCollection()

    // Get the process to complete
    const process = await processesCol.findOne({ _id: new ObjectId(processId) })

    if (!process) {
      return NextResponse.json(
        { error: 'Process not found' },
        { status: 404 }
      )
    }

    if (process.status === ProcessStatus.COMPLETED) {
      return NextResponse.json(
        { error: 'Process is already completed' },
        { status: 400 }
      )
    }

    if (process.status !== ProcessStatus.STARTED) {
      return NextResponse.json(
        { error: 'Process must be in STARTED status to complete' },
        { status: 400 }
      )
    }

    // Verify order exists
    const order = await ordersCol.findOne({ _id: new ObjectId(id) })
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Get karigar info
    const karigar = await karigarsCol.findOne({ _id: new ObjectId(process.karigarId) })
    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }

    const now = new Date()
    let goldLoss = 0
    let stonesAdded: ProcessStep['stonesAdded']

    // Special handling for stone setting process
    if (process.processType === ProcessType.STONE_SETTING) {
      // Use stone data that was stored when the process was started
      let totalStoneWeight = 0

      const adStones = process.adStonesAdded || []
      const kalesStones = process.kalesStonesAdded || []

      adStones.forEach((stone: any) => {
        totalStoneWeight += stone.totalWeight || 0
      })

      kalesStones.forEach((stone: any) => {
        totalStoneWeight += stone.totalWeight || 0
      })

      // For stone setting: 
      // The stored inputWeight already includes both gold + stones combined weight
      // So gold loss = stored inputWeight (combined weight) - output weight
      goldLoss = Math.max(0, process.inputWeight - outputWeight)

      // Store stones information for workflow tracking
      if (totalStoneWeight > 0) {
        stonesAdded = {
          adStones: adStones.length > 0 ? adStones : undefined,
          kalesStones: kalesStones.length > 0 ? kalesStones : undefined,
          totalStoneWeight
        }
      }
    } else {
      // For other processes: normal weight loss calculation
      if (outputWeight > process.inputWeight) {
        return NextResponse.json(
          { error: 'Output weight cannot be greater than input weight for this process type' },
          { status: 400 }
        )
      }
      goldLoss = Math.max(0, process.inputWeight - outputWeight)
    }

    // Get karat purity for fine gold calculations
    const selectedKarat = order.selectedKarat || 92
    const karatPurity = selectedKarat / 100

    // Calculate fine gold equivalent of loss for tracking
    const goldLossFineEquivalent = goldLoss * karatPurity

    // Update the process with completion data
    const updateData: any = {
      outputWeight,
      goldLoss,
      status: ProcessStatus.COMPLETED,
      completedAt: now,
      updatedAt: now
    }

    await processesCol.updateOne(
      { _id: new ObjectId(processId) },
      { $set: updateData }
    )

    // Create process step for order workflow tracking
    const processStep: ProcessStep = {
      processType: process.processType as ProcessType,
      karigarId: process.karigarId,
      karigarName: karigar.name,
      inputWeight: process.inputWeight,
      outputWeight: outputWeight,
      goldLoss,
      ...(stonesAdded && { stonesAdded }),
      processedAt: now,
      sequence: process.sequence
    }

    // Update order workflow tracking
    const currentProcessWorkflow = order.processWorkflow || {
      currentProcess: 1,
      totalProcesses: 4,
      processesCompleted: []
    }

    const updatedProcessesCompleted = [...currentProcessWorkflow.processesCompleted, processStep]
    const nextProcess = process.sequence < 4 ? process.sequence + 1 : 4
    const totalWeightLoss = updatedProcessesCompleted.reduce((sum, p) => sum + p.goldLoss, 0)

    // Calculate actual final weight from the chronologically last completed process
    // Sort by processedAt timestamp to get the most recent process
    let actualFinalWeight = order.originalOrderWeight
    if (updatedProcessesCompleted.length > 0) {
      const sortedByTime = [...updatedProcessesCompleted].sort((a, b) =>
        new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
      )
      actualFinalWeight = sortedByTime[0].outputWeight
    }

    // Calculate total stone weight from all completed processes
    const totalStoneWeight = updatedProcessesCompleted.reduce((sum, p) => {
      if (p.stonesAdded && p.stonesAdded.totalStoneWeight) {
        return sum + p.stonesAdded.totalStoneWeight
      }
      return sum
    }, 0)

    await ordersCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          processWorkflow: {
            currentProcess: nextProcess,
            totalProcesses: 4, // Keep the total processes for reference
            processesCompleted: updatedProcessesCompleted
          },
          actualFinalWeight,
          totalStoneWeight, // Update the total stone weight on the order
          totalWeightLoss,
          updatedAt: now
          // Don't automatically mark as ready for completion here
          // Let the frontend logic decide based on completed processes
        }
      }
    )

    // Create gold loss transaction and move loss into global karigar loss stock if there's any loss
    if (goldLoss > 0) {
      const lossDescription = process.processType === ProcessType.STONE_SETTING ?
        `Gold loss in ${process.processType} process by ${karigar.name} (including stone weight adjustment)` :
        `Gold loss in ${process.processType} process by ${karigar.name}`

      const lossTransaction = {
        orderId: id,
        type: TransactionType.GOLD_LOSS,
        amount: goldLoss,
        description: lossDescription,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      await transactionsCol.insertOne(lossTransaction)

      // Update inventory: increase global karigar loss stock only (no admin stock)
      const inventoryCol = await getInventoryCollection()
      await inventoryCol.updateOne(
        {},
        {
          $inc: {
            karigarLossStock: goldLoss
          },
          $set: { lastUpdated: now }
        },
        { upsert: true }
      )
    }

    // Get the updated process with all related data
    const updatedProcess = await processesCol.findOne({ _id: new ObjectId(processId) })
    const customer = await customersCol.findOne({ _id: new ObjectId(order.customerId) })

    const processWithDetails = {
      ...toClientFormat(updatedProcess!),
      karigar: toClientFormat(karigar),
      order: {
        ...toClientFormat(order),
        customer: customer ? toClientFormat(customer) : null
      }
    }

    return NextResponse.json({
      process: processWithDetails,
      workflowUpdate: {
        currentProcess: nextProcess,
        totalWeightLoss,
        actualFinalWeight,
        isComplete: process.sequence >= 4
      },
      message: `${process.processType} process completed successfully. Output recorded: ${outputWeight}g, Loss: ${goldLoss}g`
    })
  } catch (error) {
    console.error('Error completing manufacturing process:', error)
    return NextResponse.json(
      { error: 'Failed to complete manufacturing process' },
      { status: 500 }
    )
  }
}
