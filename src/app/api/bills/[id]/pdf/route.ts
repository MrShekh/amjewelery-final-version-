import { NextRequest, NextResponse } from 'next/server'
import { getBillsCollection, getUsersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

// GET /api/bills/[id]/pdf - Generate PDF for bill
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

    const { id } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid bill ID' },
        { status: 400 }
      )
    }

    const billsCol = await getBillsCollection()

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

    // For now, return JSON response indicating PDF generation
    // You can implement actual PDF generation here using the bill data
    const billData = {
      customer: bill.customerDetails,
      order: bill.orderDetails,
      billing: bill.billing,
      processes: bill.processes || []
    }

    // Create bill data for PDF generation
    const { generateBillPDF } = await import('@/utils/pdfGenerator')
    
    const billDataForPDF = {
      customer: {
        name: bill.customerDetails.name,
        phone: bill.customerDetails.phone,
        email: bill.customerDetails.email || '',
        address: bill.customerDetails.address || 'Not provided'
      },
      order: {
        id: bill.orderDetails.id,
        orderName: bill.orderDetails.orderName,
        status: 'DELIVERED',
        createdAt: bill.orderDetails.createdAt,
        finalJewelryWeight: bill.orderDetails.finalJewelryWeight,
        manufacturingCost: bill.billing.manufacturingCostGrams
      },
      billing: {
        goldToReturn: bill.billing.actualGoldWeightInFineGold,
        manufacturingCostDue: bill.billing.manufacturingCostGrams,
        goldReturned: 0,
        manufacturingCostPaid: 0,
        goldPending: bill.billing.currentOrderOwedFineGold || bill.billing.actualGoldWeightInFineGold,
        costPending: bill.billing.manufacturingCostGrams,
        totalBillAmount: bill.billing.totalCustomerOwedFineGold,
        billingCompleted: bill.status === 'PAID'
      },
      // Add past jama information if available
      jamaHistory: bill.pastPendingAmounts && bill.pastPendingAmounts.totalAmount > 0 ? {
        totalGiven: bill.pastPendingAmounts.totalAmount,
        totalReturned: 0,
        totalPending: bill.pastPendingAmounts.totalAmount,
        details: bill.pastPendingAmounts.details || []
      } : undefined,
      processes: (bill.processes || []).map((process: any) => ({
        id: process.id,
        processType: process.processType,
        inputWeight: process.inputWeight,
        outputWeight: process.outputWeight,
        goldLoss: process.goldLoss,
        goldRecovered: 0,
        karigarName: process.karigar.name
      }))
    }

    const pdfBlob = await generateBillPDF(billDataForPDF)
    const buffer = Buffer.from(await pdfBlob.arrayBuffer())

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Bill_${bill.billNumber}.pdf"`,
        'Content-Length': buffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Error generating bill PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
