import { NextRequest, NextResponse } from 'next/server'
import { getBillsCollection, getUsersCollection, getCustomersCollection, getOrdersCollection, getCustomerJamaBalancesCollection, getInventoryCollection, getManufacturingProcessesCollection, getGoldTransactionsCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

// GET /api/bills/[id] - Get individual bill details
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
        { error: 'Invalid bill ID' },
        { status: 400 }
      )
    }

    const billsCol = await getBillsCollection()
    const customersCol = await getCustomersCollection()
    const ordersCol = await getOrdersCollection()

    // Get the bill
    const bill = await billsCol.findOne({ 
      _id: new ObjectId(id),
      $or: [
        { userId: user._id.toString() },
        { organizationId: user.organizationId }
      ]
    })

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      )
    }

    // Populate customer details
    const customer = await customersCol.findOne({ _id: new ObjectId(bill.customerId) })
    
    // Get order details and name if orderId exists
    let orderName = null
    if (bill.orderId) {
      try {
        const order = await ordersCol.findOne({ _id: new ObjectId(bill.orderId) })
        if (order) {
          orderName = order.orderName
        }
      } catch (error) {
        console.error('Error fetching order name for bill:', bill._id, error)
      }
    }

    // Prepare the response with populated data
    const billWithDetails = {
      ...toClientFormat(bill),
      customer: customer ? { 
        name: customer.name, 
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address || ''
      } : null,
      orderName: orderName
    }

    return NextResponse.json({
      success: true,
      bill: billWithDetails
    })

  } catch (error) {
    console.error('Error fetching bill:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bill' },
      { status: 500 }
    )
  }
}

// DELETE /api/bills/[id] - Delete bill and its corresponding order
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
        { error: 'Invalid bill ID' },
        { status: 400 }
      )
    }

    const billsCol = await getBillsCollection()
    const ordersCol = await getOrdersCollection()
    const inventoryCol = await getInventoryCollection()
    const customerJamaCol = await getCustomerJamaBalancesCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()

    // Find the bill
    const bill = await billsCol.findOne({ 
      _id: new ObjectId(id),
      $or: [
        { userId: user._id.toString() },
        { organizationId: user.organizationId }
      ]
    })

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      )
    }

    const orderId = bill.orderId;

    // 1. Revert inventory updates using bill data
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

    // Delete customer jama balance entry linked to this order/bill
    if (orderId) {
      await customerJamaCol.deleteOne({ orderId: orderId })
    }

    // Delete the bill itself
    await billsCol.deleteOne({ _id: bill._id })

    // 2. Delete corresponding order if exists, restoring karigar stock
    if (orderId) {
      const orderObjectId = ObjectId.isValid(orderId) ? new ObjectId(orderId) : orderId;
      const order = await ordersCol.findOne({ _id: orderObjectId })
      
      if (order) {
        // Clear in-process stock for this order
        await inventoryCol.deleteOne({
          type: 'in-process',
          orderId: orderId
        })

        // Restore karigar stock
        const processes = await processesCol.find({ orderId: orderId }).toArray()
        const karatPurity = order.selectedKarat || 92
        let totalKarigarStockToRestore = order.totalGoldUsed || 0
        let totalExtraStockToRestore = 0

        for (const process of processes) {
          if (process.additionalWeight && process.additionalWeight > 0) {
            totalExtraStockToRestore += process.additionalWeight
          }
        }

        if (totalKarigarStockToRestore > 0) {
          const fineGoldAmount = totalKarigarStockToRestore * (karatPurity / 100)
          await inventoryCol.updateOne(
            { type: 'karigar', purity: karatPurity },
            { $inc: { amount: fineGoldAmount } },
            { upsert: true }
          )
        }

        if (totalExtraStockToRestore > 0) {
          const extraFineGoldAmount = totalExtraStockToRestore * (karatPurity / 100)
          await inventoryCol.updateOne(
            { type: 'extra', purity: karatPurity },
            { $inc: { amount: extraFineGoldAmount } },
            { upsert: true }
          )
        }

        // Delete all related processes, transactions, and the order itself
        await Promise.all([
          processesCol.deleteMany({ orderId: orderId }),
          transactionsCol.deleteMany({ orderId: orderId }),
          ordersCol.deleteOne({ _id: orderObjectId })
        ])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bill and corresponding order deleted successfully. Stocks reverted.'
    })

  } catch (error) {
    console.error('Error deleting bill:', error)
    return NextResponse.json(
      { error: 'Failed to delete bill' },
      { status: 500 }
    )
  }
}
