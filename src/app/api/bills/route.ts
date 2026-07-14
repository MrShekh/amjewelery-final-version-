import { NextRequest, NextResponse } from 'next/server'
import { getInventoryCollection, getGoldTransactionsCollection, getUsersCollection, getCustomersCollection, getBillsCollection, getOrdersCollection } from '@/lib/mongodb'
import { TransactionType, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

// GET /api/bills - Get customer bills (paginated)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page') || '1'
    const limitParam = searchParams.get('limit') || '10'
    const statusParam = searchParams.get('status')
    const search = searchParams.get('search') || ''

    const page = Math.max(parseInt(pageParam, 10) || 1, 1)
    const limit = Math.max(Math.min(parseInt(limitParam, 10) || 10, 100), 1)

    const billsCol = await getBillsCollection()
    const customersCol = await getCustomersCollection()
    const ordersCol = await getOrdersCollection()

    // Base filter: by user / organization
    const userCondition = {
      $or: [
        { userId: user._id.toString() },
        { organizationId: user.organizationId }
      ]
    }

    const andConditions: any[] = [userCondition]

    if (statusParam) {
      andConditions.push({ status: statusParam })
    }

    // Optional search: bill number, customer name, or order name
    if (search) {
      const searchRegex = new RegExp(search, 'i')

      // Find customers whose name matches search
      const matchingCustomers = await customersCol.find(
        { name: searchRegex },
        { projection: { _id: 1 } }
      ).toArray()
      const matchingCustomerIds = matchingCustomers.map((c: any) => c._id.toString())

      // Find orders whose orderName matches search
      const matchingOrders = await ordersCol.find(
        { orderName: searchRegex },
        { projection: { _id: 1 } }
      ).toArray()
      const matchingOrderIds = matchingOrders.map((o: any) => o._id.toString())

      const searchOr: Record<string, unknown>[] = [
        { billNo: { $regex: searchRegex } },
        { billNumber: { $regex: searchRegex } },
      ]

      if (matchingCustomerIds.length > 0) {
        searchOr.push({ customerId: { $in: matchingCustomerIds } })
      }

      if (matchingOrderIds.length > 0) {
        searchOr.push({ orderId: { $in: matchingOrderIds } })
      }

      andConditions.push({ $or: searchOr })
    }

    const filter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0]

    const totalCount = await billsCol.countDocuments(filter)

    if (totalCount === 0) {
      return NextResponse.json({ bills: [], page, limit, totalCount, totalPages: 0 })
    }

    const skip = (page - 1) * limit

    // Get paginated bills for this user/organization
    const bills = await billsCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    // Bulk-load related customers and orders for this page
    const customerIds = Array.from(new Set(
      bills
        .map(bill => bill.customerId)
        .filter((id): id is string => !!id)
    ))

    const orderIds = Array.from(new Set(
      bills
        .map(bill => bill.orderId)
        .filter((id): id is string => !!id && ObjectId.isValid(id))
        .map(id => id as string)
    ))

    const [customers, orders] = await Promise.all([
      customerIds.length > 0
        ? customersCol.find(
            { _id: { $in: customerIds.map(id => new ObjectId(id)) } },
            { projection: { name: 1, phone: 1, email: 1, address: 1 } }
          ).toArray()
        : Promise.resolve([]),
      orderIds.length > 0
        ? ordersCol.find(
            { _id: { $in: orderIds.map(id => new ObjectId(id)) } },
            {
              projection: {
                _id: 1,
                orderName: 1,
                orderPhoto: 1,
                orderNumber: 1,
                finalJewelryWeight: 1,
                actualFinalWeight: 1,
                actualGoldWeight: 1,
                totalStoneWeight: 1,
                selectedKarat: 1,
              }
            }
          ).toArray()
        : Promise.resolve([]),
    ])

    const customersMap = new Map<string, any>()
    customers.forEach((c) => {
      customersMap.set(c._id.toString(), c)
    })

    const ordersMap = new Map<string, any>()
    orders.forEach((o) => {
      ordersMap.set(o._id.toString(), o)
    })

    // Populate customer details and order details using the preloaded maps
    const billsWithCustomers = bills.map((bill) => {
      const customer = bill.customerId ? customersMap.get(bill.customerId) : null

      let orderDetails = null
      if (bill.orderId && ObjectId.isValid(bill.orderId)) {
        const order = ordersMap.get(bill.orderId)
        if (order) {
          orderDetails = {
            id: order._id.toString(),
            orderName: order.orderName,
            orderPhoto: order.orderPhoto,
            orderNumber: order.orderNumber,
            finalJewelryWeight: order.finalJewelryWeight,
            actualFinalWeight: order.actualFinalWeight,
            actualGoldWeight: order.actualGoldWeight,
            totalStoneWeight: order.totalStoneWeight,
            selectedKarat: order.selectedKarat,
          }
        } else {
          // Fall back to existing orderDetails from bill if order not found in this page's lookup
          orderDetails = bill.orderDetails || null
        }
      } else {
        // Use existing orderDetails for standalone bills
        orderDetails = bill.orderDetails || null
      }

      return {
        ...toClientFormat(bill),
        orderDetails,
        customerDetails: customer
          ? {
              name: customer.name,
              phone: customer.phone,
              email: customer.email || '',
              address: customer.address || '',
            }
          : null,
        // Keep legacy customer field for backward compatibility
        customer: customer
          ? {
              name: customer.name,
              phone: customer.phone,
              address: customer.address,
            }
          : null,
      }
    })

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({ bills: billsWithCustomers, page, limit, totalCount, totalPages })

  } catch (error) {
    console.error('Error fetching bills:', error)
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 })
  }
}

// POST /api/bills - Create new customer bill
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const {
      customerId,
      billNo,
      completeOrderWeight, // in grams
      kalesStoneWeight = 0, // in grams
      adWeight = 0, // in grams
      manufacturingCost = 0, // in grams
      removeKalesStone = false,
      removeAdWeight = false,
      advanceGoldUsed = 0, // in grams - manual override
      itemDetails = [], // array of items
      termsAndConditions = '',
      notes = '',
      orderId = null // optional order ID reference
    } = body

    // Validation
    if (!customerId || !billNo || !completeOrderWeight) {
      return NextResponse.json(
        { error: 'Customer, Bill No, and Complete Order Weight are required' },
        { status: 400 }
      )
    }

    // Calculate final weight
    let finalWeight = parseFloat(completeOrderWeight)
    let orderAdvanceGold = 0 // Advance gold from order
    let effectiveAdvanceGold = parseFloat(advanceGoldUsed) || 0 // Manual override or order advance
    
    // NEW LOGIC: Check if order has advance gold
    let order = null
    if (orderId) {
      try {
        const ordersCol = await getOrdersCollection()
        order = await ordersCol.findOne({ _id: new ObjectId(orderId) })
        if (order && order.customerAdvanceGold && order.customerAdvanceGold > 0) {
          orderAdvanceGold = order.customerAdvanceGold
          // Use order advance gold if no manual override provided
          if (advanceGoldUsed === 0) {
            effectiveAdvanceGold = orderAdvanceGold
          }
          console.log(`Order ${orderId} has advance gold: ${orderAdvanceGold}g, using: ${effectiveAdvanceGold}g`)
        }
      } catch (error) {
        console.error('Error fetching order for advance gold calculation:', error)
        // Continue with manual advance gold if order fetch fails
      }
    }
    
    const calculationBreakdown = {
      completeOrderWeight: parseFloat(completeOrderWeight),
      kalesStoneWeight: parseFloat(kalesStoneWeight),
      adWeight: parseFloat(adWeight),
      manufacturingCost: parseFloat(manufacturingCost),
      removeKalesStone,
      removeAdWeight,
      advanceGoldUsed: effectiveAdvanceGold, // Updated to use effective advance gold
      orderAdvanceGold: orderAdvanceGold, // Track order advance gold separately
      advanceGoldSource: orderAdvanceGold > 0 ? 'order' : 'manual', // Track source
      finalWeight: 0, // Will be calculated below
      remainingBalance: 0 // Will be calculated below
    }

    // Subtract weights if customer requested
    if (removeKalesStone && kalesStoneWeight > 0) {
      finalWeight -= parseFloat(kalesStoneWeight)
    }
    if (removeAdWeight && adWeight > 0) {
      finalWeight -= parseFloat(adWeight)
    }

    // Add manufacturing cost
    if (manufacturingCost > 0) {
      finalWeight += parseFloat(manufacturingCost)
    }

    calculationBreakdown.finalWeight = finalWeight
    
    // Validate advance gold usage
    if (effectiveAdvanceGold > 0) {
      if (effectiveAdvanceGold > finalWeight) {
        return NextResponse.json(
          { error: 'Advance gold cannot exceed the final bill weight' },
          { status: 400 }
        )
      }
    }
    
    // NEW LOGIC: Calculate remaining balance after advance gold deduction
    // This is what customer still owes (pending gold)
    const remainingBalance = finalWeight - effectiveAdvanceGold
    calculationBreakdown.remainingBalance = remainingBalance

    const billsCol = await getBillsCollection()
    const customersCol = await getCustomersCollection()
    const inventoryCol = await getInventoryCollection()
    const transactionsCol = await getGoldTransactionsCollection()

    // Check if bill number already exists
    const existingBill = await billsCol.findOne({ 
      billNo: billNo,
      $or: [
        { userId: user._id.toString() },
        { organizationId: user.organizationId }
      ]
    })

    if (existingBill) {
      return NextResponse.json(
        { error: 'Bill number already exists' },
        { status: 400 }
      )
    }

    // Get customer details
    const customer = await customersCol.findOne({ _id: new ObjectId(customerId) })
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const now = new Date()
    
    // Create bill record
    const billData: any = {
      userId: user._id.toString(),
      organizationId: user.organizationId,
      customerId: customerId,
      billNo: billNo,
      calculation: calculationBreakdown,
      itemDetails: itemDetails,
      termsAndConditions: termsAndConditions,
      notes: notes,
      status: 'CREATED',
      createdAt: now,
      updatedAt: now,
      createdBy: {
        id: user._id.toString(),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      }
    }
    
    // Add orderId if provided
    if (orderId) {
      billData.orderId = orderId
    }

    const billResult = await billsCol.insertOne(billData)

    // Update the associated order's status and making charge automatically
    if (orderId) {
      try {
        const ordersCol = await getOrdersCollection()
        await ordersCol.updateOne(
          { _id: new ObjectId(orderId) },
          {
            $set: {
              status: 'DELIVERED',
              makingCharge: parseFloat(manufacturingCost) || 0,
              updatedAt: now
            }
          }
        )
        console.log(`Successfully updated order ${orderId} status to DELIVERED and makingCharge to ${manufacturingCost}`)
      } catch (err) {
        console.error('Error updating order fields in generic bill creation:', err)
      }
    }
    
    // Handle inventory updates
    const userId = user._id.toString()
    const organizationId = user.organizationId
    
    // Find user's inventory
    let inventory = await inventoryCol.findOne({ 
      $or: [
        { userId: userId },
        { organizationId: organizationId }
      ]
    })

    // NEW LOGIC: Validate advance gold is available if being used
    if (effectiveAdvanceGold > 0) {
      const availableAdvanceGold = inventory?.advanceCustomerStock || 0
      if (effectiveAdvanceGold > availableAdvanceGold) {
        return NextResponse.json(
          { error: `Insufficient advance gold. Available: ${availableAdvanceGold}g, Requested: ${effectiveAdvanceGold}g` },
          { status: 400 }
        )
      }
    }

    if (!inventory) {
      // Create inventory if doesn't exist
      const initialInventory = {
        userId: userId,
        organizationId: organizationId,
        adminStock: effectiveAdvanceGold, // NEW LOGIC: Add advance gold to admin stock
        karigarStock: 0,
        customerStock: remainingBalance, // NEW LOGIC: Add pending gold (remaining balance) to customer stock
        advanceCustomerStock: -effectiveAdvanceGold, // Deduct advance gold (could be negative if no initial advance)
        lastUpdated: now,
        createdAt: now
      }
      await inventoryCol.insertOne(initialInventory)
    } else {
      // Update existing inventory
      const updates: any = {
        customerStock: (inventory.customerStock || 0) + remainingBalance, // NEW LOGIC: Add pending gold to customer stock
        lastUpdated: now
      }
      
      // NEW LOGIC: Handle advance gold settlement - move from advance stock to admin stock
      if (effectiveAdvanceGold > 0) {
        updates.adminStock = (inventory.adminStock || 0) + effectiveAdvanceGold // Transfer advance gold to admin stock
        updates.advanceCustomerStock = (inventory.advanceCustomerStock || 0) - effectiveAdvanceGold // Deduct from advance stock
      }
      
      await inventoryCol.updateOne(
        { _id: inventory._id },
        { $set: updates }
      )
    }

    // NEW LOGIC: Create transaction records
    const transactions = []
    
    // Main transaction for the bill (customer owes remaining balance - pending gold)
    if (remainingBalance > 0) {
      const mainTransactionDoc = {
        type: TransactionType.JAMA_GOLD_ADDED, // Customer owes this gold
        amount: remainingBalance,
        description: `Customer bill created - Bill No: ${billNo}, Customer: ${customer.name}. Final required: ${finalWeight}g${effectiveAdvanceGold > 0 ? `, Advance used: ${effectiveAdvanceGold}g` : ''}, Pending: ${remainingBalance}g${
          orderAdvanceGold > 0 ? ` (advance from order ${orderId})` : ''
        }`,
        recoveredGold: 0,
        customerId: customerId,
        billId: billResult.insertedId.toString(),
        orderId: orderId || null,
        createdAt: now,
        updatedAt: now
      }
      transactions.push(mainTransactionDoc)
    }
    
    // NEW LOGIC: Transaction for advance gold settlement (transfer from advance to admin)
    if (effectiveAdvanceGold > 0) {
      const advanceSettlementDoc = {
        type: TransactionType.GOLD_IN, // Gold transferred from advance stock to admin stock
        amount: effectiveAdvanceGold,
        description: `Advance gold settlement - Bill No: ${billNo}, Customer: ${customer.name}. Transferred from advance stock to admin stock${
          orderAdvanceGold > 0 ? ` (from order ${orderId})` : ' (manual entry)'
        }`,
        recoveredGold: 0,
        customerId: customerId,
        billId: billResult.insertedId.toString(),
        orderId: orderId || null,
        createdAt: now,
        updatedAt: now
      }
      transactions.push(advanceSettlementDoc)
    }
    
    // Insert all transactions
    if (transactions.length > 0) {
      await transactionsCol.insertMany(transactions)
    }

    // Get the created bill with customer details
    const createdBill = await billsCol.findOne({ _id: billResult.insertedId })
    const billWithCustomer = {
      ...toClientFormat(createdBill!),
      customer: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address
      }
    }

    return NextResponse.json({
      message: 'Customer bill created successfully',
      bill: billWithCustomer,
      totalWeight: finalWeight,
      advanceGoldUsed: effectiveAdvanceGold,
      orderAdvanceGold: orderAdvanceGold,
      remainingBalance: remainingBalance,
      pendingGoldAdded: remainingBalance, // NEW LOGIC: This is the pending gold added to customer stock
      advanceGoldSettled: effectiveAdvanceGold, // NEW LOGIC: This is advance gold moved to admin stock
      advanceGoldTransferred: effectiveAdvanceGold > 0,
      advanceGoldSource: orderAdvanceGold > 0 ? 'order' : 'manual',
      settlementSummary: {
        finalRequiredGold: finalWeight,
        advanceGoldAvailable: effectiveAdvanceGold,
        pendingGoldOwed: remainingBalance,
        advanceMovedToAdminStock: effectiveAdvanceGold,
        pendingAddedToCustomerStock: remainingBalance
      }
    })

  } catch (error) {
    console.error('Error creating bill:', error)
    return NextResponse.json(
      { error: 'Failed to create bill' },
      { status: 500 }
    )
  }
}
