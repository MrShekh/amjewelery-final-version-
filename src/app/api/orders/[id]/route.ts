import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getCustomersCollection, getManufacturingProcessesCollection, getGoldTransactionsCollection, getKarigarsCollection, getUsersCollection, getInventoryCollection, getCustomerJamaBalancesCollection, getBillsCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { truncateToThreeDecimals } from '@/utils/numberFormat'

// GET /api/orders/[id] - Get order by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const ordersCol = await getOrdersCollection()
    const customersCol = await getCustomersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const karigarsCol = await getKarigarsCollection()

    const order = await ordersCol.findOne({ _id: new ObjectId(id) })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Get customer
    const customer = await customersCol.findOne(
      { _id: new ObjectId(order.customerId) },
      { projection: { name: 1, phone: 1, email: 1 } }
    )

    // Get processes with karigar info
    const processes = await processesCol.find({ orderId: id }).sort({ sequence: 1 }).toArray()
    const processesWithKarigar = await Promise.all(
      processes.map(async (process) => {
        const karigar = await karigarsCol.findOne(
          { _id: new ObjectId(process.karigarId) },
          { projection: { name: 1, specialty: 1 } }
        )
        return {
          ...toClientFormat(process),
          karigar: karigar ? { name: karigar.name, specialty: karigar.specialty } : null
        }
      })
    )

    // Get transactions
    const transactions = await transactionsCol.find({ orderId: id }).sort({ createdAt: -1 }).toArray()

    const orderWithDetails = {
      ...toClientFormat(order),
      customer: customer ? { name: customer.name, phone: customer.phone, email: customer.email } : null,
      processes: processesWithKarigar,
      transactions: transactions.map(t => toClientFormat(t))
    }

    return NextResponse.json({ order: orderWithDetails })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

// PUT /api/orders/[id] - Update order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      status,
      manufacturingCost,
      adminProfitGold
    } = body

    const ordersCol = await getOrdersCollection()
    const customersCol = await getCustomersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const karigarsCol = await getKarigarsCollection()

    // Check if order exists
    const existingOrder = await ordersCol.findOne({ _id: new ObjectId(id) })
    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    }

    if (status) updateData.status = status
    if (manufacturingCost !== undefined) updateData.manufacturingCost = manufacturingCost
    if (adminProfitGold !== undefined) updateData.adminProfitGold = adminProfitGold

    // Map karat and bagNumber if provided from spreadsheet cell edits
    if (body.karat !== undefined) {
      const parsedKarat = parseFloat(body.karat)
      updateData.selectedKarat = !isNaN(parsedKarat) ? parsedKarat : body.karat
    }
    if (body.bagNumber !== undefined) {
      updateData.orderNumber = body.bagNumber
    }

    // Spreadsheet text fields
    if (body.orderName !== undefined) updateData.orderName = body.orderName
    if (body.fillingKarigar !== undefined) updateData.fillingKarigar = body.fillingKarigar
    if (body.settingKarigar !== undefined) updateData.settingKarigar = body.settingKarigar
    if (body.polishKarigar !== undefined) updateData.polishKarigar = body.polishKarigar
    if (body.adNote !== undefined) updateData.adNote = body.adNote
    if (body.klStoneNote !== undefined) updateData.klStoneNote = body.klStoneNote
    if (body.orderPhoto !== undefined) updateData.orderPhoto = body.orderPhoto

    // Spreadsheet numeric fields
    const numericFields = [
      'fillingIn',
      'fillingOut',
      'settingLoss',
      'ad',
      'klStone',
      'polishLoss',
      'finishWeight',
      'makingCharge'
    ]

    for (const field of numericFields) {
      if (body[field] !== undefined) {
        if (body.additive && body.field === field) {
          const currentValue = existingOrder[field] || 0
          updateData[field] = parseFloat((currentValue + parseFloat(body[field])).toFixed(3))
        } else {
          updateData[field] = parseFloat(body[field]) || 0
        }
      }
    }

    // Recalculate computed fields
    const getValue = (field: string) => {
      return updateData[field] !== undefined ? (updateData[field] as number) : (existingOrder[field] || 0)
    }

    const fillingIn = getValue('fillingIn')
    const finishWeight = getValue('finishWeight')

    // In the simplified workflow, the loss is the difference between gold issued (fillingIn) and finished weight (finishWeight)
    const fillingLoss = parseFloat((fillingIn - finishWeight).toFixed(3))
    updateData.fillingLoss = fillingLoss
    updateData.totalWeightLoss = fillingLoss

    // Stones are not tracked in the registery, so they default to 0
    updateData.totalStoneWeight = 0

    updateData.actualFinalWeight = finishWeight
    updateData.actualGoldWeight = finishWeight

    // Update the order
    await ordersCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    // Sync register fields to processes collection
    await syncOrderProcessesToKarigars(id)

    // Get updated order with all related data
    const updatedOrder = await ordersCol.findOne({ _id: new ObjectId(id) })

    // Get customer
    const customer = await customersCol.findOne({ _id: new ObjectId(updatedOrder!.customerId) })

    // Get processes with karigar info
    const processes = await processesCol.find({ orderId: id }).sort({ sequence: 1 }).toArray()
    const processesWithKarigar = await Promise.all(
      processes.map(async (process) => {
        const karigar = await karigarsCol.findOne({ _id: new ObjectId(process.karigarId) })
        return {
          ...toClientFormat(process),
          karigar: karigar ? toClientFormat(karigar) : null
        }
      })
    )

    // Get transactions
    const transactions = await transactionsCol.find({ orderId: id }).sort({ createdAt: -1 }).toArray()

    const orderWithDetails = {
      ...toClientFormat(updatedOrder!),
      customer: customer ? toClientFormat(customer) : null,
      processes: processesWithKarigar,
      transactions: transactions.map(t => toClientFormat(t))
    }

    return NextResponse.json({ order: orderWithDetails })
  } catch (error) {
    console.error('Error updating order:', error)

    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

// DELETE /api/orders/[id] - Delete order and restore stock
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const ordersCol = await getOrdersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const inventoryCol = await getInventoryCollection()
    const billsCol = await getBillsCollection()
    const customerJamaCol = await getCustomerJamaBalancesCollection()

    // Check if order exists
    const existingOrder = await ordersCol.findOne({ _id: new ObjectId(id) })
    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // If order is delivered (billed), revert billing updates
    if (existingOrder.status === 'DELIVERED') {
      const bill = await billsCol.findOne({
        $or: [
          { orderId: id },
          { orderId: new ObjectId(id) }
        ]
      })

      if (bill) {
        const advanceGoldUsed = bill.billing?.advanceGoldUsed || 0
        const totalCustomerOwedFineGold = bill.billing?.totalCustomerOwedFineGold || 0

        const inventory = await inventoryCol.findOne({})
        if (inventory) {
          const inventoryUpdate: any = {
            $inc: {},
            $set: { lastUpdated: new Date() }
          }
          if (advanceGoldUsed > 0) {
            inventoryUpdate.$inc.advanceCustomerStock = advanceGoldUsed
            inventoryUpdate.$inc.adminStock = -advanceGoldUsed
          }
          if (totalCustomerOwedFineGold > 0) {
            inventoryUpdate.$inc.customerStock = -totalCustomerOwedFineGold
          }

          if (Object.keys(inventoryUpdate.$inc).length > 0) {
            await inventoryCol.updateOne({ _id: inventory._id }, inventoryUpdate)
          }
        }

        // Delete customer jama balance entry linked to this order
        await customerJamaCol.deleteOne({ orderId: id })
        // Delete the bill itself
        await billsCol.deleteOne({ _id: bill._id })
      }
    }

    // Get all processes for this order to analyze stock usage
    const processes = await processesCol.find({ orderId: id }).toArray()
    const karatPurity = existingOrder.selectedKarat || 92

    // Step 1: Clear in-process stock for this order
    await inventoryCol.deleteOne({
      type: 'in-process',
      orderId: id
    })
    console.log(`Cleared in-process stock for order ${id}`)

    // Step 2: Restore stock based on order status and processes
    let totalKarigarStockToRestore = 0
    let totalExtraStockToRestore = 0

    if (existingOrder.status === 'CREATED') {
      // Order was just created, restore the initially allocated karigar stock
      totalKarigarStockToRestore = existingOrder.totalGoldUsed || 0

    } else if (existingOrder.status === 'IN_PROCESS' || existingOrder.status === 'COMPLETED' || existingOrder.status === 'DELIVERED') {
      // Order had processes, need to analyze each process

      // Start with the original karigar stock allocation
      totalKarigarStockToRestore = existingOrder.totalGoldUsed || 0

      // Add any extra stock that was used in processes
      for (const process of processes) {
        if (process.additionalWeight && process.additionalWeight > 0) {
          totalExtraStockToRestore += process.additionalWeight
        }
      }
    }

    // Restore karigar stock
    if (totalKarigarStockToRestore > 0) {
      const fineGoldAmount = totalKarigarStockToRestore * (karatPurity / 100)

      await inventoryCol.updateOne(
        { type: 'karigar', purity: karatPurity },
        { $inc: { amount: fineGoldAmount } },
        { upsert: true }
      )

      console.log(`Restored ${fineGoldAmount.toFixed(3)}g fine gold (${totalKarigarStockToRestore.toFixed(3)}g at ${karatPurity}%) to karigar stock`)
    }

    // Restore extra stock
    if (totalExtraStockToRestore > 0) {
      const extraFineGoldAmount = totalExtraStockToRestore * (karatPurity / 100)

      await inventoryCol.updateOne(
        { type: 'extra', purity: karatPurity },
        { $inc: { amount: extraFineGoldAmount } },
        { upsert: true }
      )

      console.log(`Restored ${extraFineGoldAmount.toFixed(3)}g fine gold (${totalExtraStockToRestore.toFixed(3)}g at ${karatPurity}%) to extra stock`)
    }

    // Delete all related data
    await Promise.all([
      // Delete all processes
      processesCol.deleteMany({ orderId: id }),
      // Delete all transactions
      transactionsCol.deleteMany({ orderId: id }),
      // Delete the order itself
      ordersCol.deleteOne({ _id: new ObjectId(id) })
    ])

    const totalRestored = totalKarigarStockToRestore + totalExtraStockToRestore
    console.log(`Order ${id} deleted successfully, restored ${totalRestored.toFixed(3)}g total stock (${totalKarigarStockToRestore.toFixed(3)}g karigar + ${totalExtraStockToRestore.toFixed(3)}g extra)`)

    return NextResponse.json({
      message: `Order deleted successfully. Restored ${totalKarigarStockToRestore.toFixed(3)}g to karigar stock and ${totalExtraStockToRestore.toFixed(3)}g to extra stock. In-process stock cleared.`,
      karigarStockRestored: totalKarigarStockToRestore,
      extraStockRestored: totalExtraStockToRestore,
      inProcessStockCleared: true
    })

  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    )
  }
}

// Helper function to sync order register sheet cells to manufacturing processes
async function syncOrderProcessesToKarigars(orderId: string) {
  try {
    const ordersCol = await getOrdersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const karigarsCol = await getKarigarsCollection()
    const inventoryCol = await getInventoryCollection()

    // 1. Fetch updated order
    const order = await ordersCol.findOne({ _id: new ObjectId(orderId) })
    if (!order) return

    // Define the stages to sync
    const stages = [
      {
        processType: 'FILING',
        sequence: 1,
        karigarName: order.fillingKarigar,
        loss: 0, // Set loss to 0 so karigar is not charged
        inputWeight: order.fillingIn || 0,
        outputWeight: order.finishWeight || 0,
      },
      {
        processType: 'STONE_SETTING',
        sequence: 3,
        karigarName: order.settingKarigar,
        loss: 0, // Set loss to 0 so karigar is not charged
        inputWeight: 0,
        outputWeight: 0,
      },
      {
        processType: 'FINAL_POLISH',
        sequence: 4,
        karigarName: order.polishKarigar,
        loss: 0, // Set loss to 0 so karigar is not charged
        inputWeight: 0,
        outputWeight: 0,
      }
    ]

    for (const stage of stages) {
      const { processType, sequence, karigarName, loss, inputWeight, outputWeight } = stage

      // Find if process already exists for this order and stage
      const existingProcess = await processesCol.findOne({
        orderId: orderId,
        processType: processType
      })

      if (!karigarName || karigarName.trim() === '') {
        // If karigar name is empty/removed, delete existing process and revert loss from inventory
        if (existingProcess) {
          if (!existingProcess.isFullyRecovered && (existingProcess.goldLoss || 0) > 0) {
            await inventoryCol.updateOne(
              {},
              {
                $inc: {
                  karigarLossStock: -truncateToThreeDecimals(existingProcess.goldLoss)
                }
              }
            )
          }
          await processesCol.deleteOne({ _id: existingProcess._id })
        }
        continue
      }

      // Find or create karigar by name
      let karigar = await karigarsCol.findOne({
        name: { $regex: new RegExp(`^${karigarName.trim()}$`, 'i') }
      })

      if (!karigar) {
        const newKarigarId = new ObjectId()
        await karigarsCol.insertOne({
          _id: newKarigarId,
          name: karigarName.trim(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        karigar = { _id: newKarigarId, name: karigarName.trim() }
      }

      const karigarId = karigar._id.toString()

      // Calculate change in loss to adjust inventory
      let lossDiff = loss
      if (existingProcess) {
        if (!existingProcess.isFullyRecovered) {
          lossDiff = loss - (existingProcess.goldLoss || 0)
        } else {
          // If already recovered, do not adjust inventory
          lossDiff = 0
        }
      }

      // Update or insert process document
      const processData: any = {
        orderId: orderId,
        karigarId: karigarId,
        processType: processType,
        inputWeight: truncateToThreeDecimals(inputWeight),
        outputWeight: truncateToThreeDecimals(outputWeight),
        goldLoss: truncateToThreeDecimals(loss),
        sequence: sequence,
        status: 'COMPLETED',
        updatedAt: new Date()
      }

      if (!existingProcess) {
        processData.createdAt = new Date()
        processData.isFullyRecovered = false
        processData.goldRecovered = 0
        processData.startedAt = new Date()
        processData.completedAt = new Date()
        await processesCol.insertOne(processData)
      } else {
        await processesCol.updateOne(
          { _id: existingProcess._id },
          {
            $set: {
              karigarId: karigarId,
              inputWeight: processData.inputWeight,
              outputWeight: processData.outputWeight,
              goldLoss: processData.goldLoss,
              status: 'COMPLETED',
              updatedAt: new Date()
            }
          }
        )
      }

      // Update inventory karigarLossStock
      if (lossDiff !== 0) {
        await inventoryCol.updateOne(
          {},
          {
            $inc: {
              karigarLossStock: truncateToThreeDecimals(lossDiff)
            },
            $set: {
              lastUpdated: new Date()
            }
          },
          { upsert: true }
        )
      }
    }
  } catch (err) {
    console.error('Error syncing order processes to karigars:', err)
  }
}

