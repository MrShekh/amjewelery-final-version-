import { NextRequest, NextResponse } from 'next/server'
import { getCustomersCollection, getOrdersCollection, getManufacturingProcessesCollection, getGoldTransactionsCollection, getKarigarsCollection, getCustomerJamaBalancesCollection, getUsersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

// GET /api/customers/[id] - Get customer by ID
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
    console.log('Fetching customer with ID:', id)

    if (!ObjectId.isValid(id)) {
      console.log('Invalid ObjectId:', id)
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    console.log('Getting database collections...')
    const customersCol = await getCustomersCollection()
    const ordersCol = await getOrdersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const karigarsCol = await getKarigarsCollection()
    const jamaBalancesCol = await getCustomerJamaBalancesCollection()
    console.log('Database collections obtained successfully')

    console.log('Searching for customer with ObjectId:', id)
    const customer = await customersCol.findOne({ _id: new ObjectId(id) })

    if (!customer) {
      console.log('Customer not found with ID:', id)
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }
    console.log('Customer found:', customer.name)

    // Get orders for this customer
    console.log('Fetching orders for customer ID:', id)
    const orders = await ordersCol.find({ customerId: id }).toArray()
    console.log(`Found ${orders.length} orders for customer`)

    // Get processes and transactions for each order
    console.log('Processing order details...')
    const ordersWithDetails = await Promise.all(
      orders.map(async (order, index) => {
        try {
          console.log(`Processing order ${index + 1}/${orders.length} - ID: ${order._id}`)
          const orderId = order._id.toString()

          // Get manufacturing processes
          console.log(`Fetching processes for order ${orderId}`)
          const processes = await processesCol.find({ orderId }).toArray()
          console.log(`Found ${processes.length} processes for order ${orderId}`)

          const processesWithKarigar = await Promise.all(
            processes.map(async (process, processIndex) => {
              try {
                console.log(`Fetching karigar for process ${processIndex + 1}/${processes.length}`)
                const karigar = await karigarsCol.findOne({ _id: new ObjectId(process.karigarId) })
                return {
                  ...toClientFormat(process),
                  karigar: karigar ? toClientFormat(karigar) : null
                }
              } catch (processError) {
                console.error(`Error processing process ${process._id}:`, processError)
                return {
                  ...toClientFormat(process),
                  karigar: null
                }
              }
            })
          )

          // Get transactions
          console.log(`Fetching transactions for order ${orderId}`)
          const transactions = await transactionsCol.find({ orderId }).toArray()
          console.log(`Found ${transactions.length} transactions for order ${orderId}`)

          return {
            ...toClientFormat(order),
            imageUrl: order.orderPhoto, // Map orderPhoto to imageUrl for frontend
            actualFinalWeight: order.actualFinalWeight, // Include actual final weight
            actualGoldWeight: order.actualGoldWeight, // Include actual gold weight (without stones)
            totalStoneWeight: order.totalStoneWeight, // Include stone weight
            selectedKarat: order.selectedKarat, // Include karat purity for fine gold calculation
            customerGoldWeight: order.customerAdvanceGold || 0, // Map customerAdvanceGold to customerGoldWeight for frontend compatibility
            processes: processesWithKarigar,
            transactions: transactions.map(t => toClientFormat(t))
          }
        } catch (orderError) {
          console.error(`Error processing order ${order._id}:`, orderError)
          // Return basic order info even if details fail
          return {
            ...toClientFormat(order),
            imageUrl: order.orderPhoto,
            actualFinalWeight: order.actualFinalWeight,
            actualGoldWeight: order.actualGoldWeight,
            totalStoneWeight: order.totalStoneWeight,
            selectedKarat: order.selectedKarat,
            customerGoldWeight: order.customerAdvanceGold || 0, // Map customerAdvanceGold to customerGoldWeight for frontend compatibility
            processes: [],
            transactions: []
          }
        }
      })
    )
    console.log('Finished processing all order details')

    // Get jama gold balances for this customer
    console.log('Fetching jama gold balances for customer ID:', id)
    const jamaBalances = await jamaBalancesCol.find({ customerId: id }).toArray()
    console.log(`Found ${jamaBalances.length} jama gold balances for customer`)

    const jamaBalancesWithOrder = await Promise.all(
      jamaBalances.map(async (balance, balanceIndex) => {
        try {
          console.log(`Processing jama balance ${balanceIndex + 1}/${jamaBalances.length}`)
          let order = null
          if (balance.orderId && ObjectId.isValid(balance.orderId)) {
            console.log(`Fetching order ${balance.orderId} for jama balance`)
            order = await ordersCol.findOne({ _id: new ObjectId(balance.orderId) })
          }
          return {
            ...toClientFormat(balance),
            order: order ? toClientFormat(order) : null
          }
        } catch (balanceError) {
          console.error(`Error processing jama balance ${balance._id}:`, balanceError)
          return {
            ...toClientFormat(balance),
            order: null
          }
        }
      })
    )
    console.log('Finished processing jama gold balances')

    // Calculate jama gold summary
    console.log('Calculating jama gold summary')
    // Use goldBalance for new billing entries, jamaGoldAmount for old manual entries
    const totalJamaGold = jamaBalances.reduce((sum, balance) => {
      const goldAmount = balance.goldBalance || balance.jamaGoldAmount || 0
      return sum + goldAmount
    }, 0)
    const totalJamaReturned = jamaBalances.reduce((sum, balance) => sum + (balance.returnedAmount || 0), 0)
    // Calculate pending as total minus returned
    const totalJamaPending = Math.max(0, totalJamaGold - totalJamaReturned)
    console.log('Jama gold summary calculated:', { totalJamaGold, totalJamaReturned, totalJamaPending })

    // Calculate advance gold from orders
    console.log('Calculating customer advance gold from orders')
    const totalAdvanceGold = orders.reduce((sum, order) => sum + (order.customerAdvanceGold || 0), 0)
    console.log('Total advance gold calculated:', totalAdvanceGold)

    // Fetch all transactions for this customer
    console.log('Fetching all transactions for customer ID:', id)
    const customerTransactions = await transactionsCol.find({
      $or: [
        { customerId: id },
        { orderId: { $in: orders.map(o => o._id.toString()) } }
      ]
    }).toArray()
    console.log(`Found ${customerTransactions.length} transactions for customer`)

    const customerWithOrders = {
      ...toClientFormat(customer),
      orders: ordersWithDetails,
      jamaGold: {
        balances: jamaBalancesWithOrder,
        summary: {
          totalJamaGold,
          totalJamaReturned,
          totalJamaPending,
          returnPercentage: totalJamaGold > 0 ? (totalJamaReturned / totalJamaGold) * 100 : 0
        }
      },
      advanceGold: {
        totalAdvanceGold
      },
      transactions: customerTransactions.map(t => toClientFormat(t))
    }

    return NextResponse.json({ customer: customerWithOrders })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

// PUT /api/customers/[id] - Update customer
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
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, phone, email, address } = body

    const customersCol = await getCustomersCollection()

    // Check if customer exists
    const existingCustomer = await customersCol.findOne({ _id: new ObjectId(id) })
    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Check for duplicate phone/email (excluding current customer)
    const duplicateCheck = await customersCol.findOne({
      _id: { $ne: new ObjectId(id) },
      $or: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : [])
      ]
    })

    if (duplicateCheck) {
      return NextResponse.json(
        { error: 'Phone or email already exists' },
        { status: 400 }
      )
    }

    await customersCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name,
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          updatedAt: new Date()
        }
      }
    )

    const updatedCustomer = await customersCol.findOne({ _id: new ObjectId(id) })

    return NextResponse.json({ customer: toClientFormat(updatedCustomer!) })
  } catch (error) {
    console.error('Error updating customer:', error)

    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

// DELETE /api/customers/[id] - Delete customer
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
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const customersCol = await getCustomersCollection()
    const result = await customersCol.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer:', error)

    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}
