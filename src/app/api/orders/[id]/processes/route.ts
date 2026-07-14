import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getKarigarsCollection, getManufacturingProcessesCollection, getGoldTransactionsCollection, getCustomersCollection, getInventoryCollection } from '@/lib/mongodb'
import { ProcessType, ProcessStatus, TransactionType, ProcessStep, OrderStatus, ManufacturingProcess, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { KARAT_PURITY_VALUES, getPurityDisplayName, KaratPurity } from '@/lib/gold-conversions'

// POST /api/orders/[id]/processes - Add manufacturing process with comprehensive workflow tracking
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
      outputWeight,
      // Special fields for stone setting process
      adStonesAdded,
      kalesStonesAdded
    } = body

    // Validation
    if (!karigarId || !processType || inputWeight === undefined || outputWeight === undefined) {
      return NextResponse.json(
        { error: 'Karigar ID, process type, input weight, and output weight are required' },
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

    // For non-stone setting processes, output should not exceed input
    if (processType !== ProcessType.STONE_SETTING && outputWeight > inputWeight) {
      return NextResponse.json(
        { error: 'Output weight cannot be greater than input weight for this process type' },
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
    
    // Handle different process logic based on workflow requirements
    let actualInputWeight = inputWeight
    let actualOutputWeight = outputWeight
    let goldLoss = 0
    let stonesAdded: ProcessStep['stonesAdded']
    
    // Deduct from karat-specific karigar stock on first process (filing) if using karigar stock
    if (processType === ProcessType.FILING && order.useKarigarStock && !order.karigarStockDeducted) {
      const inventory = await inventoryCol.findOne({})
      if (!inventory) {
        return NextResponse.json(
          { error: 'Inventory not found' },
          { status: 500 }
        )
      }
      
      // Determine which karat stock to use based on order's selectedKarat
      const selectedKarat = order.selectedKarat || 92 // Default to 92% (22k) if not specified
      
      // Validate karat purity
      if (!KARAT_PURITY_VALUES.includes(selectedKarat)) {
        return NextResponse.json(
          { error: `Unsupported karat purity: ${selectedKarat}%. Supported purities: ${KARAT_PURITY_VALUES.map(p => getPurityDisplayName(p)).join(', ')}` },
          { status: 400 }
        )
      }
      
      const suffix = selectedKarat.toString().replace('.', '')
      const karatStockField = `karigar${suffix}Stock`
      const currentKaratStock = inventory[karatStockField] || 0
      const karatDisplayName = getPurityDisplayName(selectedKarat as KaratPurity)
      
      // Use actual input weight for stock deduction (not pre-calculated order amount)
      const stockDeductionAmount = inputWeight
      
      // Check if we have sufficient karat-specific stock
      if (stockDeductionAmount > currentKaratStock) {
        return NextResponse.json(
          { error: `Insufficient ${karatDisplayName} karigar stock. Available: ${currentKaratStock.toFixed(3)}g, Required: ${stockDeductionAmount.toFixed(3)}g` },
          { status: 400 }
        )
      }
      
      // Move gold from available to in-process stock (proper inventory tracking)
      const inProcessField = karatStockField.replace('Stock', 'InProcess')
      
      const updateQuery: any = {
        $set: { lastUpdated: now },
        $inc: {}
      }
      
      // Move from available stock to in-process stock
      updateQuery.$inc[karatStockField] = -stockDeductionAmount  // Reduce available stock
      updateQuery.$inc[inProcessField] = stockDeductionAmount    // Increase in-process stock
      
      // DO NOT change karigarStock (fine gold total) - it should remain the same
      // Total fine gold = (available karat stocks + in-process karat stocks) 
      // Since we're only moving between available and in-process, total remains unchanged
      
      await inventoryCol.updateOne(
        { _id: inventory._id },
        updateQuery
      )
      
      // Mark stock as deducted and record the actual amount used
      await ordersCol.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            karigarStockDeducted: true, 
            karigarStockAmount: stockDeductionAmount, // Record actual amount deducted
            updatedAt: now 
          } 
        }
      )
      
      // Record the stock deduction transaction with karat info
      await transactionsCol.insertOne({
        orderId: id,
        type: TransactionType.KARIGAR_STOCK_DEDUCTION,
        amount: stockDeductionAmount,
        description: `${karatDisplayName} karigar stock deducted for filing process: ${order.orderName} (${stockDeductionAmount.toFixed(3)}g input weight)`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      })
      
      console.log(`Deducted ${stockDeductionAmount.toFixed(3)}g from ${karatDisplayName} stock for order ${order.orderName} filing process`)
    }
    
    // Special handling for stone setting process
    if (processType === ProcessType.STONE_SETTING) {
      // Calculate total stone weight from stones being added
      let totalStoneWeight = 0
      
      const adStones = adStonesAdded || []
      const kalesStones = kalesStonesAdded || []
      
      adStones.forEach((stone: any) => {
        totalStoneWeight += stone.totalWeight || 0
      })
      
      kalesStones.forEach((stone: any) => {
        totalStoneWeight += stone.totalWeight || 0
      })
      
      // For stone setting: 
      // Expected weight after adding stones = input weight + stone weight
      // Actual loss = expected weight - output weight
      // This means: loss = (input weight + stone weight) - output weight
      const expectedWeightWithStones = inputWeight + totalStoneWeight
      goldLoss = Math.max(0, expectedWeightWithStones - outputWeight)
      
      // Store stones information
      if (totalStoneWeight > 0) {
        stonesAdded = {
          adStones: adStones.length > 0 ? adStones : undefined,
          kalesStones: kalesStones.length > 0 ? kalesStones : undefined,
          totalStoneWeight
        }
      }
    } else {
      // For other processes: normal weight loss calculation
      goldLoss = Math.max(0, inputWeight - outputWeight)
    }

    // Get karat purity for fine gold calculations
    const selectedKarat = order.selectedKarat || 92
    const karatPurity = selectedKarat / 100 // Convert to decimal (92 -> 0.92)
    
    // Calculate fine gold equivalent of loss for tracking
    const goldLossFineEquivalent = goldLoss * karatPurity
    
    // Determine sequence number based on process type
    const processSequenceMap = {
      [ProcessType.FILING]: 1,
      [ProcessType.FREE_POLISH]: 2,
      [ProcessType.STONE_SETTING]: 3,
      [ProcessType.FINAL_POLISH]: 4
    }
    const sequence = processSequenceMap[processType as ProcessType]

    // Create process step for order workflow tracking
    const processStep: ProcessStep = {
      processType: processType as ProcessType,
      karigarId,
      karigarName: karigar.name,
      inputWeight: actualInputWeight,
      outputWeight: actualOutputWeight,
      goldLoss,
      ...(stonesAdded && { stonesAdded }),
      processedAt: now,
      sequence
    }

    // Create the manufacturing process record with karat-based loss tracking
    const processDoc: ManufacturingProcess = {
      orderId: id,
      karigarId,
      processType: processType,
      inputWeight: actualInputWeight,
      outputWeight: actualOutputWeight,
      goldLoss, // Track loss in karat terms (same as working stock)
      sequence,
      status: ProcessStatus.COMPLETED, // Old route creates completed processes
      startedAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now
    }
    
    const processResult = await processesCol.insertOne(processDoc)

    // Update order workflow tracking
    const currentProcessWorkflow = order.processWorkflow || {
      currentProcess: 1,
      totalProcesses: 4,
      processesCompleted: []
    }
    
    const updatedProcessesCompleted = [...currentProcessWorkflow.processesCompleted, processStep]
    const nextProcess = sequence < 4 ? sequence + 1 : 4
    const totalWeightLoss = updatedProcessesCompleted.reduce((sum, p) => sum + p.goldLoss, 0)
    
    // Calculate actual final weight from the last completed process
    const actualFinalWeight = updatedProcessesCompleted.length > 0 ? 
      updatedProcessesCompleted[updatedProcessesCompleted.length - 1].outputWeight :
      order.originalOrderWeight

    await ordersCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          processWorkflow: {
            currentProcess: nextProcess,
            totalProcesses: 4,
            processesCompleted: updatedProcessesCompleted
          },
          actualFinalWeight,
          totalWeightLoss,
          status: sequence < 4 ? OrderStatus.IN_PROCESS : OrderStatus.IN_PROCESS, // Keep IN_PROCESS until manually completed
          updatedAt: now
        }
      }
    )

    // Create gold loss transaction if there's any loss
    if (goldLoss > 0) {
      const lossDescription = processType === ProcessType.STONE_SETTING ?
        `Gold loss in ${processType} process by ${karigar.name} (including stone weight adjustment)` :
        `Gold loss in ${processType} process by ${karigar.name}`
        
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
    }

    // Update order status to IN_PROCESS if it's still CREATED
    if (order.status === OrderStatus.CREATED) {
      await ordersCol.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: OrderStatus.IN_PROCESS, updatedAt: now } }
      )
    }
    
    // Get the updated order and created process with all related data
    const updatedOrder = await ordersCol.findOne({ _id: new ObjectId(id) })
    const createdProcess = await processesCol.findOne({ _id: processResult.insertedId })
    const customer = await customersCol.findOne({ _id: new ObjectId(order.customerId) })
    
    const processWithDetails = {
      ...toClientFormat(createdProcess!),
      karigar: toClientFormat(karigar),
      order: {
        ...toClientFormat(updatedOrder!),
        customer: customer ? toClientFormat(customer) : null
      }
    }

    return NextResponse.json({ 
      process: processWithDetails,
      workflowUpdate: {
        currentProcess: nextProcess,
        totalWeightLoss,
        actualFinalWeight,
        isComplete: sequence >= 4
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating manufacturing process:', error)
    return NextResponse.json(
      { error: 'Failed to create manufacturing process' },
      { status: 500 }
    )
  }
}

// GET /api/orders/[id]/processes - Get all processes for an order
export async function GET(
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
    
    const processesCol = await getManufacturingProcessesCollection()
    const karigarsCol = await getKarigarsCollection()
    
    const processes = await processesCol.find({ orderId: id }).sort({ sequence: 1 }).toArray()
    
    // Get karigar info for each process
    const processesWithKarigar = await Promise.all(
      processes.map(async (process) => {
        const karigar = await karigarsCol.findOne({ _id: new ObjectId(process.karigarId) })
        return {
          ...toClientFormat(process),
          karigar: karigar ? toClientFormat(karigar) : null
        }
      })
    )

    return NextResponse.json({ processes: processesWithKarigar })
  } catch (error) {
    console.error('Error fetching manufacturing processes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch manufacturing processes' },
      { status: 500 }
    )
  }
}
