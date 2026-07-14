import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getInventoryCollection, getGoldTransactionsCollection, getCustomerJamaBalancesCollection, getCustomersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'

// GET /api/orders/[id]/billing - Get order billing details
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

    const ordersCol = await getOrdersCollection()
    const jamaBalancesCol = await getCustomerJamaBalancesCollection()
    const customersCol = await getCustomersCollection()
    
    const order = await ordersCol.findOne({ _id: new ObjectId(id) })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // If billing info doesn't exist, calculate it
    if (!order.billing && order.status === 'COMPLETED') {
      // Calculate net billable weight (final weight - stone weight)
      const stoneWeight = order.stoneWeight || 0 // in grams
      const netBillableWeight = Math.max(0, order.finalJewelryWeight - stoneWeight)
      
      const billing = {
        actualWeight: order.finalJewelryWeight, // Total final weight including stones
        stoneWeight: stoneWeight, // Weight of stones to be deducted
        netBillableWeight: netBillableWeight, // Billable gold weight (final - stones)
        customerGoldGiven: order.customerGoldWeight, // Gold customer provided
        adminGoldUsed: order.adminGoldWeight, // Extra gold admin provided for manufacturing
        totalGoldUsed: order.totalGoldUsed, // Total gold used in manufacturing
        goldToReturn: netBillableWeight, // Customer returns net billable weight only
        manufacturingCostDue: order.manufacturingCost,
        manufacturingCostType: order.manufacturingCostType || 'MONEY', // 'MONEY' or 'GOLD'
        goldReturned: 0,
        manufacturingCostPaid: 0,
        goldPending: netBillableWeight,
        costPending: order.manufacturingCost,
        totalBillAmount: order.manufacturingCost, // Can add gold value conversion here
        billingCompleted: false
      }

      await ordersCol.updateOne(
        { _id: new ObjectId(id) },
        { $set: { billing, updatedAt: new Date() } }
      )

      order.billing = billing
    }
    
    // Get customer details
    const customer = await customersCol.findOne({ _id: new ObjectId(order.customerId) })

    return NextResponse.json({ 
      order: toClientFormat(order),
      customer: customer ? toClientFormat(customer) : null
    })
  } catch (error) {
    console.error('Error fetching order billing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order billing' },
      { status: 500 }
    )
  }
}

// POST /api/orders/[id]/billing - Initialize billing for completed order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { 
      stoneWeight, 
      manufacturingCostAmount, 
      manufacturingCostType, 
      goldRatePerGram 
    } = body
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const ordersCol = await getOrdersCollection()
    const order = await ordersCol.findOne({ _id: new ObjectId(id) })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Order must be completed to initialize billing' },
        { status: 400 }
      )
    }

    // Calculate net billable weight (final weight - stone weight)
    const finalStoneWeight = stoneWeight || order.stoneWeight || 0
    const netBillableWeight = Math.max(0, order.finalJewelryWeight - finalStoneWeight)
    const finalManufacturingCostType = manufacturingCostType || 'MONEY'
    const finalManufacturingCost = manufacturingCostAmount || order.manufacturingCost || 0

    const billing = {
      actualWeight: order.finalJewelryWeight, // Total final weight including stones
      stoneWeight: finalStoneWeight, // Weight of stones to be deducted
      netBillableWeight: netBillableWeight, // Billable gold weight (final - stones)
      customerGoldGiven: order.customerGoldWeight, // Gold customer provided
      adminGoldUsed: order.adminGoldWeight, // Extra gold admin provided for manufacturing
      totalGoldUsed: order.totalGoldUsed, // Total gold used in manufacturing
      goldToReturn: netBillableWeight, // Customer returns net billable weight only
      manufacturingCostDue: finalManufacturingCost,
      manufacturingCostType: finalManufacturingCostType, // 'MONEY' or 'GOLD'
      goldReturned: 0,
      manufacturingCostPaid: 0,
      goldPending: netBillableWeight,
      costPending: finalManufacturingCost,
      totalBillAmount: finalManufacturingCostType === 'MONEY' 
        ? finalManufacturingCost 
        : finalManufacturingCost * (goldRatePerGram || 6000), // Convert gold to money if needed
      billingCompleted: false
    }

    // Also update the order with final stone weight if provided
    const updateFields: any = {
      billing,
      updatedAt: new Date(),
      status: 'DELIVERED' // Move to delivered status when billing starts
    }
    
    if (finalStoneWeight > 0) {
      updateFields.stoneWeight = finalStoneWeight
    }
    
    if (manufacturingCostAmount) {
      updateFields.manufacturingCost = finalManufacturingCost
    }
    
    if (manufacturingCostType) {
      updateFields.manufacturingCostType = finalManufacturingCostType
    }

    await ordersCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    )

    const updatedOrder = await ordersCol.findOne({ _id: new ObjectId(id) })
    return NextResponse.json({ 
      order: toClientFormat(updatedOrder!),
      message: 'Billing initialized successfully'
    })
  } catch (error) {
    console.error('Error initializing billing:', error)
    return NextResponse.json(
      { error: 'Failed to initialize billing' },
      { status: 500 }
    )
  }
}

// PUT /api/orders/[id]/billing - Update customer payment/return
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { goldReturned, manufacturingCostPaid, description } = body
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const ordersCol = await getOrdersCollection()
    const inventoryCol = await getInventoryCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const jamaBalancesCol = await getCustomerJamaBalancesCollection()

    const order = await ordersCol.findOne({ _id: new ObjectId(id) })

    if (!order || !order.billing) {
      return NextResponse.json(
        { error: 'Order or billing not found' },
        { status: 404 }
      )
    }

    const currentBilling = order.billing
    
    // Calculate new values
    const newGoldReturned = Math.min(
      currentBilling.goldReturned + (goldReturned || 0),
      currentBilling.goldToReturn
    )
    const newCostPaid = Math.min(
      currentBilling.manufacturingCostPaid + (manufacturingCostPaid || 0),
      currentBilling.manufacturingCostDue
    )

    const newGoldPending = currentBilling.goldToReturn - newGoldReturned
    const newCostPending = currentBilling.manufacturingCostDue - newCostPaid
    const billingCompleted = newGoldPending === 0 && newCostPending === 0

    // Update order billing
    const updatedBilling = {
      ...currentBilling,
      goldReturned: newGoldReturned,
      manufacturingCostPaid: newCostPaid,
      goldPending: newGoldPending,
      costPending: newCostPending,
      billingCompleted
    }

    await ordersCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: { billing: updatedBilling, updatedAt: new Date() } }
    )

    // Update inventory if gold was returned
    if (goldReturned && goldReturned > 0) {
      await inventoryCol.updateOne(
        {},
        {
          $inc: { adminStock: goldReturned },
          $set: { lastUpdated: new Date() }
        }
      )

      // Check if there's an existing jama balance for this customer/order to reduce
      const existingJamaBalance = await jamaBalancesCol.findOne({ orderId: id })
      
      if (existingJamaBalance && existingJamaBalance.pendingAmount > 0) {
        // Calculate how much jama gold to reduce
        const jamaGoldToReduce = Math.min(goldReturned, existingJamaBalance.pendingAmount)
        
        // Update jama balance
        const newReturnedAmount = existingJamaBalance.returnedAmount + jamaGoldToReduce
        const newPendingAmount = existingJamaBalance.pendingAmount - jamaGoldToReduce
        
        await jamaBalancesCol.updateOne(
          { _id: existingJamaBalance._id },
          {
            $set: {
              returnedAmount: newReturnedAmount,
              pendingAmount: newPendingAmount,
              updatedAt: new Date()
            }
          }
        )
        
        // Reduce customer stock inventory
        await inventoryCol.updateOne(
          {},
          {
            $inc: { customerStock: -jamaGoldToReduce },
            $set: { lastUpdated: new Date() }
          }
        )
        
        // Add jama gold return transaction
        await transactionsCol.insertOne({
          orderId: id,
          type: 'JAMA_GOLD_RETURNED',
          amount: jamaGoldToReduce,
          description: description || `Customer returned ${jamaGoldToReduce}g jama gold for order ${order.orderName}`,
          recoveredGold: jamaGoldToReduce,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        
        // If there's remaining gold beyond jama, record as regular gold return
        const regularGoldReturned = goldReturned - jamaGoldToReduce
        if (regularGoldReturned > 0) {
          await transactionsCol.insertOne({
            orderId: id,
            type: 'GOLD_IN',
            amount: regularGoldReturned,
            description: description || `Customer returned ${regularGoldReturned}g additional gold for order ${order.orderName}`,
            recoveredGold: regularGoldReturned,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      } else {
        // No jama balance, record as regular gold return
        await transactionsCol.insertOne({
          orderId: id,
          type: 'GOLD_IN',
          amount: goldReturned,
          description: description || `Customer returned ${goldReturned}g gold for order ${order.orderName}`,
          recoveredGold: goldReturned,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
    }

    // Record manufacturing cost payment
    if (manufacturingCostPaid && manufacturingCostPaid > 0) {
      await transactionsCol.insertOne({
        orderId: id,
        type: 'CUSTOMER_PAYMENT',
        amount: manufacturingCostPaid,
        description: description || `Manufacturing cost payment for order ${order.orderName}`,
        recoveredGold: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    // Handle jama gold - add to jama inventory if customer owes gold
    if (newGoldPending > 0 && billingCompleted) {
      // Check if jama balance already exists
      const existingJama = await jamaBalancesCol.findOne({ orderId: id })
      
      if (!existingJama) {
        // Create new jama balance
        await jamaBalancesCol.insertOne({
          customerId: order.customerId,
          orderId: id,
          jamaGoldAmount: newGoldPending,
          returnedAmount: 0,
          pendingAmount: newGoldPending,
          description: `Pending gold return from order ${order.orderName}`,
          createdAt: new Date(),
          updatedAt: new Date()
        })

        // Update customer stock inventory
        await inventoryCol.updateOne(
          {},
          {
            $inc: { customerStock: newGoldPending },
            $set: { lastUpdated: new Date() }
          }
        )

        // Add jama transaction
        await transactionsCol.insertOne({
          orderId: id,
          type: 'JAMA_GOLD_ADDED',
          amount: newGoldPending,
          description: `Jama gold added - customer owes ${newGoldPending}g from order ${order.orderName}`,
          recoveredGold: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
    }

    const updatedOrder = await ordersCol.findOne({ _id: new ObjectId(id) })
    return NextResponse.json({ 
      order: toClientFormat(updatedOrder!),
      message: 'Payment updated successfully'
    })
  } catch (error) {
    console.error('Error updating billing:', error)
    return NextResponse.json(
      { error: 'Failed to update billing' },
      { status: 500 }
    )
  }
}
