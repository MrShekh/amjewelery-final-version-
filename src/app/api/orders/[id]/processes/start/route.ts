import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getKarigarsCollection, getManufacturingProcessesCollection, getGoldTransactionsCollection, getCustomersCollection, getInventoryCollection } from '@/lib/mongodb'
import { ProcessType, ProcessStatus, TransactionType, OrderStatus, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
// POST /api/orders/[id]/processes/start - Start a manufacturing process (record input only)
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
      karigarId,
      processType,
      inputWeight,
      // Stone data for stone setting process
      adStonesAdded,
      kalesStonesAdded
    } = body

    // Validation
    if (!karigarId || !processType || inputWeight === undefined || inputWeight <= 0) {
      return NextResponse.json(
        { error: 'Karigar ID, process type, and input weight are required' },
        { status: 400 }
      )
    }

    // Validate process type
    if (!Object.values(ProcessType).includes(processType as ProcessType)) {
      return NextResponse.json(
        { error: 'Invalid process type. Must be FILING, FREE_POLISH, STONE_SETTING, or FINAL_POLISH' },
        { status: 400 }
      )
    }
    
    if (!ObjectId.isValid(karigarId)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID' },
        { status: 400 }
      )
    }

    const ordersCol = await getOrdersCollection()
    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const customersCol = await getCustomersCollection()
    const inventoryCol = await getInventoryCollection()

    // Verify order exists
    const order = await ordersCol.findOne({ _id: new ObjectId(id) })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify karigar exists
    const karigar = await karigarsCol.findOne({ _id: new ObjectId(karigarId) })

    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }

    const now = new Date()

    // Determine sequence number based on process type
    const processSequenceMap = {
      [ProcessType.FILING]: 1,
      [ProcessType.FREE_POLISH]: 2,
      [ProcessType.STONE_SETTING]: 3,
      [ProcessType.FINAL_POLISH]: 4
    }
    const sequence = processSequenceMap[processType as ProcessType]

    // Check if this process type already exists and is not completed
    const existingProcess = await processesCol.findOne({
      orderId: id,
      processType,
      status: ProcessStatus.STARTED
    })

    if (existingProcess) {
      return NextResponse.json(
        { error: `${processType} process is already started but not completed. Complete it first before starting a new one.` },
        { status: 400 }
      )
    }

    // Note: With the simplified model, we DO NOT change stock on process start.
    // Admin stock will only be reduced by the actual loss when the process is completed.

    // Create the manufacturing process record with STARTED status
    const processDoc: any = {
      orderId: id,
      karigarId,
      processType,
      inputWeight,
      status: ProcessStatus.STARTED,
      startedAt: now,
      sequence,
      createdAt: now,
      updatedAt: now
    }
    
    // Add stone data for stone setting process
    if (processType === ProcessType.STONE_SETTING) {
      if (adStonesAdded && adStonesAdded.length > 0) {
        processDoc.adStonesAdded = adStonesAdded
      }
      if (kalesStonesAdded && kalesStonesAdded.length > 0) {
        processDoc.kalesStonesAdded = kalesStonesAdded
      }
    }
    
    const processResult = await processesCol.insertOne(processDoc)

    // Update order status to IN_PROCESS if it's still CREATED
    if (order.status === OrderStatus.CREATED) {
      await ordersCol.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: OrderStatus.IN_PROCESS, updatedAt: now } }
      )
    }
    
    // Get the created process with all related data
    const createdProcess = await processesCol.findOne({ _id: processResult.insertedId })
    const customer = await customersCol.findOne({ _id: new ObjectId(order.customerId) })
    
    const processWithDetails = {
      ...toClientFormat(createdProcess!),
      karigar: toClientFormat(karigar),
      order: {
        ...toClientFormat(order),
        customer: customer ? toClientFormat(customer) : null
      }
    }

    return NextResponse.json({ 
      process: processWithDetails,
      message: `${processType} process started successfully. Gold input recorded: ${inputWeight}g`
    }, { status: 201 })
  } catch (error) {
    console.error('Error starting manufacturing process:', error)
    return NextResponse.json(
      { error: 'Failed to start manufacturing process' },
      { status: 500 }
    )
  }
}
