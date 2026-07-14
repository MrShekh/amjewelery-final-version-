import { NextRequest, NextResponse } from 'next/server'
import { getBillsCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { getUsersCollection } from '@/lib/mongodb'
import { formatForBilling } from '@/utils/numberUtils'
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001'

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

    const { billId } = await request.json()

    if (!billId || !ObjectId.isValid(billId)) {
      return NextResponse.json({ error: 'Valid bill ID is required' }, { status: 400 })
    }

    // Get bill data
    const billsCol = await getBillsCollection()
    const bill = await billsCol.findOne({ 
      _id: new ObjectId(billId),
      $or: [
        { userId: user._id.toString() },
        { organizationId: user.organizationId }
      ]
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Extract customer phone and name
    const customerPhone = bill.customerDetails?.phone || bill.customer?.phone
    const customerName = bill.customerDetails?.name || bill.customer?.name || 'Customer'

    console.log(`\n📞 CUSTOMER PHONE DEBUG:`);
    console.log(`   Bill ID: ${billId}`);
    console.log(`   Customer Name: ${customerName}`);
    console.log(`   Customer Phone from bill.customerDetails: ${bill.customerDetails?.phone}`);
    console.log(`   Customer Phone from bill.customer: ${bill.customer?.phone}`);
    console.log(`   Final Customer Phone: ${customerPhone}\n`);

    if (!customerPhone) {
      return NextResponse.json({ 
        error: 'Customer phone number not found in bill' 
      }, { status: 400 })
    }

    // Use serverless-compatible preview PDF generator (jsPDF with professional layout)
    let pdfBase64: string
    try {
      // Use the new serverless preview PDF endpoint for professional-looking bills
      const pdfEndpoint = `/api/bills/${billId}/preview-pdf-serverless`
      
      console.log(`📄 Using serverless preview PDF endpoint: ${pdfEndpoint}`);
      console.log(`   Using jsPDF generator with professional layout for serverless compatibility`);
      
      const pdfResponse = await fetch(`${request.nextUrl.origin}${pdfEndpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!pdfResponse.ok) {
        return NextResponse.json({ 
          error: 'Failed to generate PDF for bill' 
        }, { status: 500 })
      }

      // Convert PDF to base64
      const pdfBuffer = await pdfResponse.arrayBuffer()
      pdfBase64 = Buffer.from(pdfBuffer).toString('base64')
    } catch (error) {
      console.error('Error generating PDF:', error)
      return NextResponse.json({ 
        error: 'Failed to generate PDF for bill' 
      }, { status: 500 })
    }

    // Get customer's past jama gold for enhanced billing message
    const { getCustomerJamaBalancesCollection } = await import('@/lib/mongodb')
    const jamaBalancesCol = await getCustomerJamaBalancesCollection()
    
    let pastJamaAmount = 0
    try {
      // Get customer's existing jama balances (excluding the current order if exists)
      const currentOrderId = bill.orderId || bill.orderDetails?.id
      
      console.log(`🔍 PAST JAMA DEBUG - WhatsApp:`);
      console.log(`   Bill ID: ${billId}`);
      console.log(`   Current Order ID: ${currentOrderId}`);
      console.log(`   Customer ID: ${bill.customerDetails?.customerId || bill.customerId}`);
      
      const query: any = {
        customerId: bill.customerDetails?.customerId || bill.customerId
      }
      
      // Exclude current order's jama balance if we have an orderId
      if (currentOrderId) {
        query.orderId = { $ne: currentOrderId }
      }
      
      const jamaBalances = await jamaBalancesCol.find(query).toArray()
      console.log(`   Found ${jamaBalances.length} past jama balances`);
      
      pastJamaAmount = jamaBalances.reduce((sum, balance) => {
        const goldAmount = balance.goldBalance || balance.jamaGoldAmount || 0
        const returned = balance.returnedAmount || 0
        const pending = Math.max(0, goldAmount - returned)
        console.log(`   Balance: ${goldAmount}g - ${returned}g = ${pending}g (Order: ${balance.orderId || 'Manual'})`);
        return sum + pending
      }, 0)
      
      console.log(`   Total Past Jama: ${pastJamaAmount}g`);
    } catch (error) {
      console.warn('Could not fetch customer jama balances for WhatsApp message:', error)
      pastJamaAmount = 0
    }
    
    // Prepare detailed bill information for WhatsApp message with past jama structure
    const currentOrderAmount = bill.billing?.totalCustomerOwedFineGold || 0
    const totalAmount = currentOrderAmount + pastJamaAmount
    
    const billDetails = {
      // Past jama info (if exists)
      pastJamaAmount: pastJamaAmount > 0 ? 
        `${formatForBilling(pastJamaAmount)}g (from previous orders)` : 
        undefined,
      // Current order amount
      currentOrderAmount: `${formatForBilling(currentOrderAmount)}g (current order)`,
      // Total amount (past + current)
      totalAmount: `${formatForBilling(totalAmount)}g fine gold`,
      
      // Existing details (for backward compatibility)
      goldWeight: bill.billing?.billingWeightInFineGold ? 
        `${formatForBilling(bill.billing.billingWeightInFineGold)}g (Billing Weight)` : 
        undefined,
      baseWeight: bill.billing?.baseWeightSelected ? 
        `${formatForBilling(bill.billing.baseWeightSelected)}g (Base Weight)` :
        undefined,
      makingCharges: bill.billing?.manufacturingCostGrams ?
        `${formatForBilling(bill.billing.manufacturingCostGrams)}g fine gold` :
        undefined,
      advanceUsed: bill.billing?.advanceGoldUsed && bill.billing.advanceGoldUsed > 0 ?
        `${formatForBilling(bill.billing.advanceGoldUsed)}g` :
        undefined,
      orderName: bill.orderDetails?.orderName || bill.orderName || undefined,
      karat: bill.orderDetails?.selectedKarat ?
        `${bill.orderDetails.selectedKarat}% (${formatForBilling(bill.orderDetails.selectedKarat/100*24)}k)` :
        undefined,
      notes: bill.billing?.notes || undefined
    }

    // Send to WhatsApp service
    const whatsappResponse = await fetch(`${WHATSAPP_SERVICE_URL}/send-bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: customerPhone,
        customerName: customerName,
        billNumber: bill.billNumber || bill.billNo,
        pdfBuffer: pdfBase64,
        billDetails: billDetails
      })
    })

    if (!whatsappResponse.ok) {
      const errorData = await whatsappResponse.json()
      return NextResponse.json({ 
        error: errorData.error || 'Failed to send bill via WhatsApp',
        whatsappError: true
      }, { status: 500 })
    }

    const result = await whatsappResponse.json()
    
    // Update bill to mark as sent via WhatsApp (optional)
    await billsCol.updateOne(
      { _id: new ObjectId(billId) },
      { 
        $set: { 
          whatsappSentAt: new Date(),
          whatsappSentTo: result.phone
        }
      }
    )

    return NextResponse.json({ 
      success: true,
      message: result.message,
      phone: result.phone,
      customerName: customerName
    })

  } catch (error) {
    console.error('Error sending bill via WhatsApp:', error)
    return NextResponse.json({ 
      error: 'Failed to send bill via WhatsApp' 
    }, { status: 500 })
  }
}
