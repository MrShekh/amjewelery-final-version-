import { NextRequest, NextResponse } from 'next/server'
import { getCustomerJamaBalancesCollection, getOrdersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'

// GET /api/customers/[id]/jama-gold - Get jama gold balances for a specific customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const jamaBalancesCol = await getCustomerJamaBalancesCollection()
    const ordersCol = await getOrdersCollection()

    // Get all jama balances for this customer
    const jamaBalances = await jamaBalancesCol.find({ customerId: id }).toArray()

    // Add order information to each balance
    const balancesWithOrder = await Promise.all(
      jamaBalances.map(async (balance) => {
        let order = null
        if (balance.orderId && ObjectId.isValid(balance.orderId)) {
          order = await ordersCol.findOne({ _id: new ObjectId(balance.orderId) })
        }
        return {
          ...toClientFormat(balance),
          order: order ? toClientFormat(order) : null
        }
      })
    )

    // Calculate totals
    const totalJamaGold = jamaBalances.reduce((sum, balance) => sum + (balance.goldBalance || balance.jamaGoldAmount || 0), 0)
    const totalReturned = jamaBalances.reduce((sum, balance) => sum + (balance.returnedAmount || 0), 0)
    const totalPending = Math.max(0, totalJamaGold - totalReturned)

    return NextResponse.json({
      jamaBalances: balancesWithOrder,
      summary: {
        totalJamaGold,
        totalReturned,
        totalPending,
        returnPercentage: totalJamaGold > 0 ? (totalReturned / totalJamaGold) * 100 : 0
      }
    })
  } catch (error) {
    console.error('Error fetching customer jama gold balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer jama gold balances' },
      { status: 500 }
    )
  }
}

// POST /api/customers/[id]/jama-gold - Add jama gold for a specific customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { jamaGoldAmount, description, orderId } = body

    if (jamaGoldAmount == null || jamaGoldAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid jama gold amount is required' },
        { status: 400 }
      )
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    const jamaBalancesCol = await getCustomerJamaBalancesCollection()
    const { getInventoryCollection, getGoldTransactionsCollection } = await import('@/lib/mongodb')
    const inventoryCol = await getInventoryCollection()
    const transactionsCol = await getGoldTransactionsCollection()

    // Verify customer exists
    const { getCustomersCollection } = await import('@/lib/mongodb')
    const customersCol = await getCustomersCollection()
    const customer = await customersCol.findOne({ _id: new ObjectId(id) })
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // If orderId provided, verify it exists and belongs to this customer
    const ordersCol = await getOrdersCollection()
    if (orderId && ObjectId.isValid(orderId)) {
      const order = await ordersCol.findOne({ _id: new ObjectId(orderId) })
      if (!order || order.customerId !== id) {
        return NextResponse.json(
          { error: 'Invalid order ID or order does not belong to this customer' },
          { status: 400 }
        )
      }
    }

    // Create jama balance record
    const jamaBalance = {
      customerId: id,
      orderId: (orderId && ObjectId.isValid(orderId)) ? orderId : null,
      jamaGoldAmount: parseFloat(jamaGoldAmount),
      returnedAmount: 0,
      pendingAmount: parseFloat(jamaGoldAmount),
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const jamaResult = await jamaBalancesCol.insertOne(jamaBalance)

    // Update customer stock (increase)
    await inventoryCol.updateOne(
      {},
      {
        $inc: { customerStock: parseFloat(jamaGoldAmount) },
        $set: { lastUpdated: new Date() }
      }
    )

    // Add transaction record
    await transactionsCol.insertOne({
      orderId: jamaBalance.orderId,
      customerId: id,
      type: 'JAMA_GOLD_ADDED',
      amount: parseFloat(jamaGoldAmount),
      description: `Manual jama gold entry: ${description}`,
      recoveredGold: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const newBalance = await jamaBalancesCol.findOne({ _id: jamaResult.insertedId })

    return NextResponse.json({
      jamaBalance: toClientFormat(newBalance!),
      message: 'Jama gold added successfully'
    })
  } catch (error) {
    console.error('Error adding jama gold for customer:', error)
    return NextResponse.json(
      { error: 'Failed to add jama gold' },
      { status: 500 }
    )
  }
}

// PUT /api/customers/[id]/jama-gold - Customer returns jama gold
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { returnAmount, description, jamaBalanceId } = body

    if (returnAmount == null || returnAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid return amount is required' },
        { status: 400 }
      )
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    const jamaBalancesCol = await getCustomerJamaBalancesCollection()
    const { getInventoryCollection, getGoldTransactionsCollection, getCustomersCollection } = await import('@/lib/mongodb')
    const inventoryCol = await getInventoryCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const customersCol = await getCustomersCollection()

    // Verify customer exists
    const customer = await customersCol.findOne({ _id: new ObjectId(id) })
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Get customer's total pending jama gold
    const jamaBalances = await jamaBalancesCol.find({ customerId: id }).toArray()
    const totalPending = jamaBalances.reduce((sum, balance) => {
      const goldAmount = balance.goldBalance || balance.jamaGoldAmount || 0
      const returned = balance.returnedAmount || 0
      return sum + Math.max(0, goldAmount - returned)
    }, 0)

    if (returnAmount > totalPending) {
      return NextResponse.json(
        { error: `Return amount (${returnAmount}g) exceeds pending amount (${totalPending}g)` },
        { status: 400 }
      )
    }

    const now = new Date()
    let remainingReturn = parseFloat(returnAmount)

    // Update jama balances (FIFO - first in, first out)
    const pendingBalances = jamaBalances
      .filter(balance => {
        const goldAmount = balance.goldBalance || balance.jamaGoldAmount || 0
        const returned = balance.returnedAmount || 0
        return goldAmount > returned
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const updatePromises = []
    for (const balance of pendingBalances) {
      if (remainingReturn <= 0) break

      const goldAmount = balance.goldBalance || balance.jamaGoldAmount || 0
      const currentReturned = balance.returnedAmount || 0
      const pendingAmount = goldAmount - currentReturned
      const amountToReturn = Math.min(remainingReturn, pendingAmount)
      const newReturnedAmount = currentReturned + amountToReturn
      const newPendingAmount = goldAmount - newReturnedAmount

      updatePromises.push(
        jamaBalancesCol.updateOne(
          { _id: balance._id },
          {
            $set: {
              returnedAmount: newReturnedAmount,
              pendingAmount: newPendingAmount,
              updatedAt: now
            }
          }
        )
      )

      remainingReturn -= amountToReturn
    }

    await Promise.all(updatePromises)

    // Update main inventory: customer stock decreases (simple model, no admin stock)
    await inventoryCol.updateOne(
      {},
      {
        $inc: {
          customerStock: -parseFloat(returnAmount) // Remove from customer stock
        },
        $set: { lastUpdated: now }
      }
    )

    // Add transaction record
    await transactionsCol.insertOne({
      orderId: null,
      customerId: id,
      type: 'JAMA_GOLD_RETURNED',
      amount: parseFloat(returnAmount),
      description: `Customer ${customer.name} returned gold: ${description}`,
      recoveredGold: 0,
      createdAt: now,
      updatedAt: now
    })

    // Send WhatsApp notification automatically
    let whatsappResult = null
    let whatsappError = null

    try {
      // Prepare data for WhatsApp notification
      const whatsappData = {
        customerId: id,
        customerName: customer.name,
        customerPhone: customer.phone,
        collectionType: 'individual' as const,
        amountDue: totalPending,
        amountReceived: parseFloat(returnAmount),
        remainingBalance: totalPending - parseFloat(returnAmount),
        orderId: jamaBalanceId || 'Multiple Orders',
        orderName: description
      }

      console.log('🚀 Sending WhatsApp notification for jama gold collection...')

      const whatsappResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp/send-jama-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('authorization') || ''
        },
        body: JSON.stringify(whatsappData)
      })

      if (whatsappResponse.ok) {
        whatsappResult = await whatsappResponse.json()
        console.log('✅ WhatsApp notification sent successfully')
      } else {
        const whatsappErrorData = await whatsappResponse.json().catch(() => ({ error: 'Unknown WhatsApp error' }))
        whatsappError = whatsappErrorData.error || 'Failed to send WhatsApp'
        console.warn('⚠️ WhatsApp notification failed:', whatsappError)
      }
    } catch (error) {
      whatsappError = 'WhatsApp service unavailable'
      console.warn('⚠️ WhatsApp notification error:', error)
    }

    const response = {
      message: `${returnAmount}g gold returned successfully`,
      returnAmount: parseFloat(returnAmount),
      remainingPending: totalPending - parseFloat(returnAmount),
      whatsapp: whatsappResult ? {
        success: true,
        message: 'WhatsApp notification sent successfully',
        phone: whatsappResult.phone
      } : {
        success: false,
        error: whatsappError || 'WhatsApp sending failed'
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error processing gold return:', error)
    return NextResponse.json(
      { error: 'Failed to process gold return' },
      { status: 500 }
    )
  }
}
