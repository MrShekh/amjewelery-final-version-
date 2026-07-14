import { NextRequest, NextResponse } from 'next/server'
import { getCustomersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { getUsersCollection } from '@/lib/mongodb'
import { formatForBilling } from '@/utils/numberUtils'

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001'

interface JamaCollectionData {
  customerId: string
  customerName: string
  customerPhone?: string
  collectionType: 'individual' | 'bulk'
  
  // For individual collection
  orderId?: string
  orderName?: string
  amountDue?: number
  amountReceived: number
  remainingBalance: number
  
  // For bulk collection  
  totalOrders?: number
  totalAmountDue?: number
  ordersList?: Array<{
    orderId: string
    orderName: string
    amountDue: number
  }>
}

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

    const collectionData: JamaCollectionData = await request.json()

    if (!collectionData.customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    // Get customer details
    const customersCol = await getCustomersCollection()
    const customer = await customersCol.findOne({ _id: new ObjectId(collectionData.customerId) })
    
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Use phone from collectionData or fall back to customer record
    const customerPhone = collectionData.customerPhone || customer.phone
    const customerName = collectionData.customerName || customer.name || 'Customer'

    console.log(`\n📞 JAMA COLLECTION WHATSAPP DEBUG:`)
    console.log(`   Customer ID: ${collectionData.customerId}`)
    console.log(`   Customer Name: ${customerName}`)
    console.log(`   Customer Phone: ${customerPhone}`)
    console.log(`   Collection Type: ${collectionData.collectionType}\n`)

    if (!customerPhone) {
      return NextResponse.json({ 
        error: 'Customer phone number not found' 
      }, { status: 400 })
    }

    // Prepare WhatsApp message based on collection type
    let message: string
    
    if (collectionData.collectionType === 'individual') {
      // Individual collection message
      message = `Dear ${customerName},

Gold Collection Update for Order #${collectionData.orderName || collectionData.orderId}:
- Amount Due: ${formatForBilling(collectionData.amountDue || 0)}g
- Amount Received: ${formatForBilling(collectionData.amountReceived)}g  
- Remaining Balance: ${formatForBilling(collectionData.remainingBalance)}g

${collectionData.remainingBalance > 0 
  ? 'Thank you for the partial payment. Please provide the remaining balance at your convenience.' 
  : 'Thank you! Your gold collection is now complete.'
}

Thank you - AM Jewellers`
    } else {
      // Bulk collection message
      message = `Dear ${customerName},

Bulk Gold Collection Summary:
- Total Orders: ${collectionData.totalOrders || 'Multiple'}
- Total Amount Due: ${formatForBilling(collectionData.totalAmountDue || 0)}g
- Total Amount Received: ${formatForBilling(collectionData.amountReceived)}g
- Remaining Balance: ${formatForBilling(collectionData.remainingBalance)}g

${collectionData.remainingBalance > 0 
  ? 'Thank you for the partial payment. Please provide the remaining balance at your convenience.'
  : 'All pending gold collected successfully!'
}

Thank you - AM Jewellers`
    }

    // Send to WhatsApp service
    const whatsappResponse = await fetch(`${WHATSAPP_SERVICE_URL}/test-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: customerPhone,
        message: message
      })
    })

    if (!whatsappResponse.ok) {
      const errorData = await whatsappResponse.json().catch(() => ({ error: 'Unknown error' }))
      console.error('WhatsApp service error:', errorData)
      
      return NextResponse.json({ 
        error: errorData.error || 'Failed to send WhatsApp message',
        whatsappError: true
      }, { status: 500 })
    }

    const result = await whatsappResponse.json()
    
    console.log(`✅ Jama collection WhatsApp sent successfully to ${customerPhone}`)

    return NextResponse.json({ 
      success: true,
      message: 'WhatsApp notification sent successfully',
      phone: customerPhone,
      customerName: customerName,
      collectionType: collectionData.collectionType,
      whatsappResult: result
    })

  } catch (error) {
    console.error('Error sending jama collection WhatsApp:', error)
    return NextResponse.json({ 
      error: 'Failed to send WhatsApp notification' 
    }, { status: 500 })
  }
}
