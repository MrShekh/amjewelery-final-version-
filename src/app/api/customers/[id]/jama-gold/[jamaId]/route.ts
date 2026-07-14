import { NextRequest, NextResponse } from 'next/server'
import { getCustomerJamaBalancesCollection, getInventoryCollection, getGoldTransactionsCollection, getCustomersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'

// PUT /api/customers/[id]/jama-gold/[jamaId] - Update a specific jama gold entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jamaId: string }> }
) {
  try {
    const { id, jamaId } = await params
    
    if (!ObjectId.isValid(id) || !ObjectId.isValid(jamaId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID or jama gold ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { newJamaGoldAmount, description } = body

    if (!newJamaGoldAmount || newJamaGoldAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid jama gold amount is required' },
        { status: 400 }
      )
    }

    const jamaBalancesCol = await getCustomerJamaBalancesCollection()
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

    // Get the existing jama balance entry
    const existingBalance = await jamaBalancesCol.findOne({
      _id: new ObjectId(jamaId),
      customerId: id
    })

    if (!existingBalance) {
      return NextResponse.json(
        { error: 'Jama gold entry not found' },
        { status: 404 }
      )
    }

    // Calculate the difference between old and new amounts
    const oldAmount = existingBalance.jamaGoldAmount
    const newAmount = parseFloat(newJamaGoldAmount)
    const difference = newAmount - oldAmount

    // Calculate new pending amount (adjust based on how much was already returned)
    const newPendingAmount = Math.max(0, newAmount - existingBalance.returnedAmount)

    const now = new Date()

    // Update the jama balance entry
    await jamaBalancesCol.updateOne(
      { _id: new ObjectId(jamaId) },
      {
        $set: {
          jamaGoldAmount: newAmount,
          pendingAmount: newPendingAmount,
          description: description || existingBalance.description,
          updatedAt: now
        }
      }
    )

    // Update inventory: adjust customerStock by the difference
    if (difference !== 0) {
      await inventoryCol.updateOne(
        {},
        {
          $inc: { customerStock: difference },
          $set: { lastUpdated: now }
        }
      )

      // Add transaction record for the adjustment
      await transactionsCol.insertOne({
        orderId: existingBalance.orderId,
        type: 'JAMA_GOLD_ADJUSTED',
        amount: difference,
        description: `Jama gold amount updated for ${customer.name}: ${oldAmount}g → ${newAmount}g (${difference > 0 ? '+' : ''}${difference.toFixed(3)}g). ${description || 'Admin correction'}`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      })
    }

    // Get the updated balance
    const updatedBalance = await jamaBalancesCol.findOne({ _id: new ObjectId(jamaId) })

    return NextResponse.json({ 
      jamaBalance: toClientFormat(updatedBalance!),
      message: `Jama gold updated successfully from ${oldAmount}g to ${newAmount}g`,
      adjustment: difference
    })
  } catch (error) {
    console.error('Error updating jama gold entry:', error)
    return NextResponse.json(
      { error: 'Failed to update jama gold entry' },
      { status: 500 }
    )
  }
}

// POST /api/customers/[id]/jama-gold/[jamaId] - Collect gold from specific jama balance entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jamaId: string }> }
) {
  try {
    const { id, jamaId } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    if (!ObjectId.isValid(jamaId)) {
      return NextResponse.json(
        { error: 'Invalid balance ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { collectAmount, description } = body

    if (!collectAmount || collectAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid collection amount is required' },
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
    const inventoryCol = await getInventoryCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const customersCol = await getCustomersCollection()
    const { getOrdersCollection } = await import('@/lib/mongodb')
    const ordersCol = await getOrdersCollection()

    // Verify customer exists
    const customer = await customersCol.findOne({ _id: new ObjectId(id) })
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Get the specific jama balance entry
    const jamaBalance = await jamaBalancesCol.findOne({ 
      _id: new ObjectId(jamaId),
      customerId: id 
    })
    
    if (!jamaBalance) {
      return NextResponse.json(
        { error: 'Jama balance entry not found' },
        { status: 404 }
      )
    }

    // Calculate available amount for collection
    const goldAmount = jamaBalance.goldBalance || jamaBalance.jamaGoldAmount || 0
    const alreadyReturned = jamaBalance.returnedAmount || 0
    const availableForCollection = goldAmount - alreadyReturned

    if (collectAmount > availableForCollection) {
      return NextResponse.json(
        { error: `Collection amount (${collectAmount}g) exceeds available amount (${availableForCollection}g)` },
        { status: 400 }
      )
    }

    const now = new Date()
    const newReturnedAmount = alreadyReturned + collectAmount
    const newPendingAmount = goldAmount - newReturnedAmount

    // Update the specific jama balance entry
    await jamaBalancesCol.updateOne(
      { _id: new ObjectId(jamaId) },
      {
        $set: {
          returnedAmount: newReturnedAmount,
          pendingAmount: newPendingAmount,
          updatedAt: now
        }
      }
    )

    // Update main inventory: customer stock decreases (simple model, no admin stock)
    await inventoryCol.updateOne(
      {},
      {
        $inc: { 
          customerStock: -collectAmount // Remove from customer stock
        },
        $set: { lastUpdated: now }
      }
    )

    // Get order info if this is an order-specific entry
    let orderInfo = null
    if (jamaBalance.orderId) {
      orderInfo = await ordersCol.findOne({ _id: new ObjectId(jamaBalance.orderId) })
    }

    // Add transaction record
    const transactionDescription = orderInfo 
      ? `Customer ${customer.name} returned ${collectAmount}g gold from order "${orderInfo.orderName}" (${description})`
      : `Customer ${customer.name} returned ${collectAmount}g gold from manual entry (${description})`

    await transactionsCol.insertOne({
      orderId: jamaBalance.orderId || null,
      customerId: id,
      type: 'JAMA_GOLD_RETURNED',
      amount: collectAmount,
      description: transactionDescription,
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
        amountDue: goldAmount, // Total amount for this entry
        amountReceived: collectAmount,
        remainingBalance: availableForCollection - collectAmount,
        orderId: jamaBalance.orderId || jamaId,
        orderName: orderInfo ? orderInfo.orderName : (description || 'Manual Entry')
      }

      console.log('🚀 Sending WhatsApp notification for individual jama gold collection...')
      
      const whatsappResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/whatsapp/send-jama-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('authorization') || ''
        },
        body: JSON.stringify(whatsappData)
      })

      if (whatsappResponse.ok) {
        whatsappResult = await whatsappResponse.json()
        console.log('✅ WhatsApp notification sent successfully for individual collection')
      } else {
        const whatsappErrorData = await whatsappResponse.json().catch(() => ({ error: 'Unknown WhatsApp error' }))
        whatsappError = whatsappErrorData.error || 'Failed to send WhatsApp'
        console.warn('⚠️ WhatsApp notification failed for individual collection:', whatsappError)
      }
    } catch (error) {
      whatsappError = 'WhatsApp service unavailable'
      console.warn('⚠️ WhatsApp notification error for individual collection:', error)
    }

    return NextResponse.json({ 
      message: `${collectAmount}g gold collected successfully from ${orderInfo ? `order "${orderInfo.orderName}"` : 'manual entry'}`,
      collectedAmount: collectAmount,
      remainingPending: availableForCollection - collectAmount,
      orderInfo: orderInfo ? {
        id: orderInfo._id.toString(),
        orderName: orderInfo.orderName
      } : null,
      whatsapp: whatsappResult ? {
        success: true,
        message: 'WhatsApp notification sent successfully',
        phone: whatsappResult.phone
      } : {
        success: false,
        error: whatsappError || 'WhatsApp sending failed'
      }
    })
  } catch (error) {
    console.error('Error collecting gold from specific balance:', error)
    return NextResponse.json(
      { error: 'Failed to collect gold from balance entry' },
      { status: 500 }
    )
  }
}

// DELETE /api/customers/[id]/jama-gold/[jamaId] - Delete a specific jama gold entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jamaId: string }> }
) {
  try {
    const { id, jamaId } = await params
    
    if (!ObjectId.isValid(id) || !ObjectId.isValid(jamaId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID or jama gold ID' },
        { status: 400 }
      )
    }

    const jamaBalancesCol = await getCustomerJamaBalancesCollection()
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

    // Get the existing jama balance entry
    const existingBalance = await jamaBalancesCol.findOne({
      _id: new ObjectId(jamaId),
      customerId: id
    })

    if (!existingBalance) {
      return NextResponse.json(
        { error: 'Jama gold entry not found' },
        { status: 404 }
      )
    }

    // Check if any gold has been returned
    if (existingBalance.returnedAmount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete jama gold entry that has partial returns. Please contact administrator.' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Delete the jama balance entry
    await jamaBalancesCol.deleteOne({ _id: new ObjectId(jamaId) })

    // Update inventory: decrease customerStock by the full amount
    await inventoryCol.updateOne(
      {},
      {
        $inc: { customerStock: -existingBalance.jamaGoldAmount },
        $set: { lastUpdated: now }
      }
    )

    // Add transaction record for the deletion
    await transactionsCol.insertOne({
      orderId: existingBalance.orderId,
      type: 'JAMA_GOLD_DELETED',
      amount: -existingBalance.jamaGoldAmount,
      description: `Jama gold entry deleted for ${customer.name}: ${existingBalance.jamaGoldAmount}g removed. Reason: ${existingBalance.description}`,
      recoveredGold: 0,
      createdAt: now,
      updatedAt: now
    })

    return NextResponse.json({ 
      message: `Jama gold entry deleted successfully (${existingBalance.jamaGoldAmount}g removed)`,
      deletedAmount: existingBalance.jamaGoldAmount
    })
  } catch (error) {
    console.error('Error deleting jama gold entry:', error)
    return NextResponse.json(
      { error: 'Failed to delete jama gold entry' },
      { status: 500 }
    )
  }
}
