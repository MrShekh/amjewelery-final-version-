import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

interface BillItem {
  srNo: number
  orderDetail: string
  netWeight: string
  kalesStone: string
  adWeight: string
  makingCharge: string
  total: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const body = await request.json()
    
    const { 
      customerName, 
      phoneNumber, 
      invoiceNumber, 
      items, 
      totals 
    } = body

    if (!customerName || !invoiceNumber || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Customer name, invoice number, and at least one item are required' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()

    // Verify order exists and is completed
    const order = await db.collection('orders').findOne({ 
      _id: new ObjectId(orderId) 
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Order must be completed before creating a bill' },
        { status: 400 }
      )
    }

    // Get next bill number from sequence
    let nextBillNumber = invoiceNumber
    try {
      const billSequence = await db.collection('sequences').findOneAndUpdate(
        { type: 'enhanced-bill' },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: 'after' }
      )
      
      if (billSequence?.value) {
        nextBillNumber = String(billSequence.value).padStart(3, '0')
      }
    } catch (error) {
      console.log('Using provided invoice number as sequence generation failed:', error)
    }

    // Create enhanced bill document
    const enhancedBill = {
      _id: new ObjectId(),
      orderId: new ObjectId(orderId),
      billNumber: nextBillNumber,
      invoiceNumber: nextBillNumber,
      customerDetails: {
        name: customerName,
        phone: phoneNumber || order.customer?.phone,
        email: order.customer?.email,
        address: order.customer?.address
      },
      orderDetails: {
        id: orderId,
        orderName: order.orderName,
        orderType: order.orderType,
        orderPhoto: order.orderPhoto,
        actualFinalWeight: order.actualFinalWeight,
        actualGoldWeight: order.actualGoldWeight,
        totalStoneWeight: order.totalStoneWeight,
        selectedKarat: order.selectedKarat
      },
      billItems: items.map((item: BillItem) => ({
        srNo: item.srNo,
        orderDetail: item.orderDetail,
        netWeight: item.netWeight,
        kalesStone: item.kalesStone,
        adWeight: item.adWeight,
        makingCharge: item.makingCharge,
        total: item.total,
        // Extract numeric values for calculations
        netWeightValue: parseFloat(item.netWeight.replace(/[^0-9.]/g, '')) || 0,
        kalesStoneValue: parseFloat(item.kalesStone.replace(/[^0-9.]/g, '')) || 0,
        adWeightValue: parseFloat(item.adWeight.replace(/[^0-9.]/g, '')) || 0,
        makingChargeValue: parseFloat(item.makingCharge.replace(/[^0-9.]/g, '')) || 0,
        totalValue: parseFloat(item.total.replace(/[^0-9.]/g, '')) || 0
      })),
      billSummary: {
        totalNetWeight: totals?.totalNetWeight || 0,
        totalKalesStone: totals?.totalKalesStone || 0,
        totalAdWeight: totals?.totalAdWeight || 0,
        totalMakingCharge: totals?.totalMakingCharge || 0,
        grandTotal: totals?.grandTotal || 0
      },
      status: 'CREATED',
      template: 'enhanced', // To distinguish from regular bills
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: {
        // You can get this from session/auth context
        id: 'system',
        name: 'System',
        email: 'system@amjewellers.com'
      }
    }

    // Save the enhanced bill
    const result = await db.collection('enhanced_bills').insertOne(enhancedBill)

    // Update order status to indicate bill has been created
    await db.collection('orders').updateOne(
      { _id: new ObjectId(orderId) },
      { 
        $set: { 
          billCreated: true,
          enhancedBillId: result.insertedId,
          updatedAt: new Date() 
        } 
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Enhanced bill created successfully',
      billId: result.insertedId.toString(),
      billNumber: nextBillNumber,
      bill: {
        id: result.insertedId.toString(),
        billNumber: nextBillNumber,
        customerName,
        totalItems: items.length,
        grandTotal: totals?.grandTotal || 0
      }
    })

  } catch (error) {
    console.error('Error creating enhanced bill:', error)
    return NextResponse.json(
      { error: 'Failed to create enhanced bill' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const { db } = await connectToDatabase()

    // Get enhanced bill for this order
    const enhancedBill = await db.collection('enhanced_bills')
      .findOne({ orderId: new ObjectId(orderId) })

    if (!enhancedBill) {
      return NextResponse.json(
        { error: 'Enhanced bill not found for this order' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      bill: {
        ...enhancedBill,
        id: enhancedBill._id.toString(),
        orderId: enhancedBill.orderId.toString()
      }
    })

  } catch (error) {
    console.error('Error fetching enhanced bill:', error)
    return NextResponse.json(
      { error: 'Failed to fetch enhanced bill' },
      { status: 500 }
    )
  }
}
