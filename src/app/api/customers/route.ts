import { NextRequest, NextResponse } from 'next/server'
import { getCustomersCollection, getOrdersCollection, getCustomerJamaBalancesCollection, getUsersCollection } from '@/lib/mongodb'
import { Customer, toClientFormat } from '@/types/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'

// GET /api/customers - Get customers list (paginated, lightweight)
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
    const mode = searchParams.get('mode')

    // Handle dropdown mode - fetch all customers (lightweight) for selection
    if (mode === 'dropdown') {
      const customersCol = await getCustomersCollection()

      const customers = await customersCol
        .find({}, {
          projection: {
            name: 1,
            phone: 1,
            _id: 1
          }
        })
        .sort({ name: 1 }) // Sort alphabetically for dropdown
        .limit(1000) // High limit for dropdown
        .toArray()

      return NextResponse.json({
        customers: customers.map(c => ({
          id: c._id.toString(),
          name: c.name,
          phone: c.phone
        }))
      })
    }

    const pageParam = searchParams.get('page') || '1'
    const limitParam = searchParams.get('limit') || '10'
    const search = searchParams.get('search') || ''

    const page = Math.max(parseInt(pageParam, 10) || 1, 1)
    const limit = Math.max(Math.min(parseInt(limitParam, 10) || 10, 100), 1)

    const customersCol = await getCustomersCollection()
    const ordersCol = await getOrdersCollection()
    const jamaBalancesCol = await getCustomerJamaBalancesCollection()

    // Build filter for search (name/phone/email/address)
    const filter: any = {}
    if (search) {
      const regex = new RegExp(search, 'i')
      filter.$or = [
        { name: { $regex: regex } },
        { phone: { $regex: regex } },
        { email: { $regex: regex } },
        { address: { $regex: regex } },
      ]
    }

    const totalCount = await customersCol.countDocuments(filter)

    if (totalCount === 0) {
      return NextResponse.json({ customers: [], page, limit, totalCount, totalPages: 0 })
    }

    const skip = (page - 1) * limit

    // Load only basic customer fields for this page
    const customers = await customersCol
      .find(filter, {
        projection: {
          name: 1,
          phone: 1,
          email: 1,
          address: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    // For each customer on this page, fetch lightweight orders and jama summary
    const customersWithOrders = await Promise.all(
      customers.map(async (customer) => {
        const customerId = customer._id.toString()

        // Get orders (status + totalGoldUsed + createdAt) for this customer
        const orders = await ordersCol.find(
          { customerId },
          {
            projection: {
              _id: 1,
              status: 1,
              createdAt: 1,
              totalGoldUsed: 1,
            },
          }
        ).toArray()

        // Get jama gold summary (per customer) for this page only
        const jamaBalances = await jamaBalancesCol.find({ customerId }).toArray()
        const totalJamaGold = jamaBalances.reduce((sum, balance) => sum + (balance.goldBalance || balance.jamaGoldAmount || 0), 0)
        const totalJamaReturned = jamaBalances.reduce((sum, balance) => sum + (balance.returnedAmount || 0), 0)
        const totalJamaPending = Math.max(0, totalJamaGold - totalJamaReturned)

        return {
          ...toClientFormat(customer),
          orders: orders.map(order => toClientFormat(order)),
          jamaGold: {
            summary: {
              totalJamaGold,
              totalJamaReturned,
              totalJamaPending,
              returnPercentage: totalJamaGold > 0 ? (totalJamaReturned / totalJamaGold) * 100 : 0,
            },
          },
        }
      })
    )

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({ customers: customersWithOrders, page, limit, totalCount, totalPages })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

// POST /api/customers - Create a new customer
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
    const { name, phone, email, address, jamaGoldAmount, jamaDescription } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    const customersCol = await getCustomersCollection()

    // Check for existing phone or email
    const existingCustomer = await customersCol.findOne({
      $or: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : [])
      ]
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Phone or email already exists' },
        { status: 400 }
      )
    }

    const now = new Date()
    const customerDoc: Customer = {
      name,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
      createdAt: now,
      updatedAt: now
    }

    const result = await customersCol.insertOne(customerDoc)
    const customer = await customersCol.findOne({ _id: result.insertedId })
    const customerId = result.insertedId.toString()

    // Handle initial jama gold if provided
    if (jamaGoldAmount && jamaGoldAmount > 0) {
      const { getCustomerJamaBalancesCollection, getInventoryCollection, getGoldTransactionsCollection } = await import('@/lib/mongodb')
      const jamaBalancesCol = await getCustomerJamaBalancesCollection()
      const inventoryCol = await getInventoryCollection()
      const transactionsCol = await getGoldTransactionsCollection()

      // Create jama balance record
      await jamaBalancesCol.insertOne({
        customerId,
        orderId: null, // No specific order
        jamaGoldAmount: parseFloat(jamaGoldAmount),
        returnedAmount: 0,
        pendingAmount: parseFloat(jamaGoldAmount),
        description: jamaDescription || `Initial jama gold for customer ${name}`,
        createdAt: now,
        updatedAt: now
      })

      // Update customer stock (increase)
      await inventoryCol.updateOne(
        {},
        {
          $inc: { customerStock: parseFloat(jamaGoldAmount) },
          $set: { lastUpdated: now }
        }
      )

      // Add transaction record
      await transactionsCol.insertOne({
        orderId: null,
        type: 'JAMA_GOLD_ADDED',
        amount: parseFloat(jamaGoldAmount),
        description: `Initial jama gold for customer ${name}: ${jamaDescription || 'Past gold owed'}`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      })
    }

    return NextResponse.json({
      customer: toClientFormat(customer!),
      message: jamaGoldAmount && jamaGoldAmount > 0
        ? `Customer created with ${jamaGoldAmount}g jama gold`
        : 'Customer created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)

    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}
