import { NextRequest, NextResponse } from 'next/server'
import { getBillsCollection, getUsersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import jsPDF from 'jspdf'
import { formatForBilling } from '@/utils/numberUtils'

// GET /api/bills/[id]/preview-pdf-serverless - Generate preview-style PDF using jsPDF (serverless-compatible)
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

    // Generate preview-style PDF using jsPDF
    const billNumber = bill.billNumber || bill.billNo || `Bill-${bill._id.toString().slice(-6)}`
    const customerName = bill.customerDetails?.name || bill.customer?.name || 'Unknown Customer'
    const orderName = bill.orderName || bill.orderDetails?.orderName || 'ring4'
    const orderImageUrl = bill.orderDetails?.orderPhoto || (bill as any).orderPhoto || null
    
    console.log(`📄 Generating preview-style PDF using jsPDF for bill: ${billNumber}`)

    // Create new PDF document
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    
    // Colors
    const primaryBlue: [number, number, number] = [37, 99, 235] // #2563eb
    const darkGray: [number, number, number] = [26, 26, 26]
    const mediumGray: [number, number, number] = [102, 102, 102]
    const lightGray: [number, number, number] = [245, 245, 245]

    // Header Section
    pdf.setFillColor(...primaryBlue)
    pdf.rect(0, 0, pageWidth, 25, 'F')
    
    // Company Name (white text on blue background)
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(22)
    pdf.setFont('helvetica', 'bold')
    pdf.text('AM JEWELLERS', 20, 17)
    
    // Date on right side of header
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    const currentDate = new Date().toLocaleDateString('en-IN')
    pdf.text(`Date: ${currentDate}`, pageWidth - 60, 17)

    // Company Info Section
    pdf.setTextColor(...darkGray)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    let yPos = 40
    
    pdf.text('Shekh Nayem', 20, yPos)
    yPos += 6
    pdf.text('Patavadi Chowk', 20, yPos)
    yPos += 6
    pdf.text('Phone: 9907047429', 20, yPos)
    yPos += 15

    // Invoice Box (Blue background with white text)
    const invoiceBoxX = pageWidth - 80
    const invoiceBoxY = 35
    const invoiceBoxWidth = 60
    const invoiceBoxHeight = 45 // Increased height for image
    
    pdf.setFillColor(...primaryBlue)
    pdf.roundedRect(invoiceBoxX, invoiceBoxY, invoiceBoxWidth, invoiceBoxHeight, 3, 3, 'F')
    
    // Add order image or placeholder
    const imageX = invoiceBoxX + 15
    const imageY = invoiceBoxY + 5
    const imageSize = 20
    
    // Background for image area
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(imageX, imageY, imageSize, imageSize, 2, 2, 'F')
    
    // Try to load and embed the actual order image
    if (orderImageUrl) {
      try {
        console.log(`🖼️ Loading order image: ${orderImageUrl}`);
        
        // Fetch the image
        const imageResponse = await fetch(orderImageUrl)
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer()
          const imageBase64 = Buffer.from(imageBuffer).toString('base64')
          
          // Determine image format
          const imageFormat = orderImageUrl.toLowerCase().includes('.png') ? 'PNG' : 'JPEG'
          
          // Add image to PDF
          pdf.addImage(imageBase64, imageFormat, imageX, imageY, imageSize, imageSize)
          console.log(`✅ Order image loaded successfully`);
        } else {
          throw new Error('Failed to fetch image')
        }
      } catch (imageError) {
        console.warn(`⚠️ Could not load order image:`, imageError instanceof Error ? imageError.message : 'Unknown error');
        // Fall back to placeholder
        pdf.setTextColor(100, 100, 100)
        pdf.setFontSize(6)
        pdf.setFont('helvetica', 'normal')
        pdf.text('RING', imageX + 3, imageY + 10)
        pdf.text('IMG', imageX + 4, imageY + 14)
      }
    } else {
      // Show placeholder when no image URL
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(6)
      pdf.setFont('helvetica', 'normal')
      pdf.text('ORDER', imageX + 2, imageY + 9)
      pdf.text('PHOTO', imageX + 2, imageY + 13)
    }
    
    // Invoice text
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('INVOICE', invoiceBoxX + 4, invoiceBoxY + 32)
    
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`${billNumber}`, invoiceBoxX + 4, invoiceBoxY + 38)
    pdf.text(`DATE: ${currentDate}`, invoiceBoxX + 4, invoiceBoxY + 42)

    // Customer Section
    pdf.setTextColor(...darkGray)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TO:', 20, yPos)
    yPos += 8
    
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Customer Name: ${customerName}`, 20, yPos)
    
    // Add underline for customer name
    const customerTextWidth = pdf.getTextWidth(`Customer Name: ${customerName}`)
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.3)
    pdf.line(20, yPos + 2, 20 + customerTextWidth, yPos + 2)
    
    yPos += 18

    // Items Table Header - Fixed column widths to match working format
    const tableStartY = yPos
    const tableHeight = 15
    const availableWidth = pageWidth - 40 // 20px margin on each side
    const colWidths = [12, 24, 18, 16, 18, 16, 18, 20, 18] // Sr, Order, Net, Stone, Ad Wt, Wastage, Gross, Total, Rupees
    const colPositions = [20] // Start positions for each column
    
    for (let i = 1; i < colWidths.length; i++) {
      colPositions.push(colPositions[i-1] + colWidths[i-1])
    }

    // Table header background
    pdf.setFillColor(...lightGray)
    pdf.rect(20, tableStartY, pageWidth - 40, tableHeight, 'F')
    
    // Table header borders
    pdf.setDrawColor(102, 102, 102)
    pdf.setLineWidth(0.5)
    
    // Vertical lines for table header
    for (let i = 0; i <= colWidths.length; i++) {
      const x = i === 0 ? 20 : (i === colWidths.length ? pageWidth - 20 : colPositions[i])
      pdf.line(x, tableStartY, x, tableStartY + tableHeight)
    }
    
    // Horizontal lines for table header
    pdf.line(20, tableStartY, pageWidth - 20, tableStartY) // Top
    pdf.line(20, tableStartY + tableHeight, pageWidth - 20, tableStartY + tableHeight) // Bottom

    // Table headers
    pdf.setTextColor(...darkGray)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    
    const headers = ['Sr', 'Order', 'Net', 'Stone', 'Ad Wt', 'Wastage', 'Gross', 'Total', 'Rupees']
    headers.forEach((header, index) => {
      // Center align text in each column
      const centerX = colPositions[index] + (colWidths[index] / 2)
      pdf.text(header, centerX, tableStartY + 10, { align: 'center' })
    })

    // Table data row
    const dataRowY = tableStartY + tableHeight
    const dataRowHeight = 15
    
    // Data row background (white)
    pdf.setFillColor(255, 255, 255)
    pdf.rect(20, dataRowY, pageWidth - 40, dataRowHeight, 'F')
    
    // Data row borders
    for (let i = 0; i <= colWidths.length; i++) {
      const x = i === 0 ? 20 : (i === colWidths.length ? pageWidth - 20 : colPositions[i])
      pdf.line(x, dataRowY, x, dataRowY + dataRowHeight)
    }
    
    pdf.line(20, dataRowY, pageWidth - 20, dataRowY) // Top
    pdf.line(20, dataRowY + dataRowHeight, pageWidth - 20, dataRowY + dataRowHeight) // Bottom

    // Data values
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    
    // Get stone and ad weight values from multiple possible locations in bill data
    const stoneWeight = bill.calculation?.kalesStoneWeight || bill.billing?.manualStoneWeight || 0
    const adWeight = bill.calculation?.adWeight || bill.billing?.manualAdWeight || 0
    const netWeight = bill.calculation?.completeOrderWeight || bill.billing?.baseWeightSelected || bill.orderDetails?.actualGoldWeight || 11.00
    const grossWeight = bill.calculation?.finalWeight || bill.billing?.finalBillingWeight || bill.billing?.billingWeight || 11.00
    const fineWeight = bill.billing?.billingWeightInFineGold || 10.12
    const makingWeight = bill.calculation?.manufacturingCost || bill.billing?.manufacturingCostGrams || 1.94
    const advanceUsed = bill.calculation?.advanceGoldUsed || bill.billing?.advanceGoldUsed || 0
    // Use the pre-calculated total from bill data instead of recalculating
    const totalAmount = bill.billing?.totalCustomerOwedFineGold || 10.56
    
    console.log(`\n📊 PDF GENERATION DEBUG for bill ${billNumber}:`);
    console.log(`   Stone Weight: ${stoneWeight}`);
    console.log(`   Ad Weight: ${adWeight}`);
    console.log(`   Net Weight: ${netWeight}`);
    console.log(`   Gross Weight: ${grossWeight}`);
    console.log(`   Total Amount: ${totalAmount}\n`);
    
    const rowData = [
      '1',
      orderName || 'ring4',
      `${formatForBilling(netWeight)}g`,
      stoneWeight !== 0 ? `${formatForBilling(Math.abs(stoneWeight))}g` : '-',
      adWeight !== 0 ? `${formatForBilling(Math.abs(adWeight))}g` : '-', // Ad Weight with 'g'
      bill.billing?.makingCharge ? String(bill.billing.makingCharge) : '-', // Wastage column - making charge value, no 'g'
      `${formatForBilling(grossWeight)}g`,
      `${totalAmount.toFixed(3)}g`, // Fixed to show exactly 3 decimal places
      `₹${bill.billing?.rupees || '0'}` // Rupees from bill data
    ]
    
    rowData.forEach((data, index) => {
      // Center align data in each column
      const centerX = colPositions[index] + (colWidths[index] / 2)
      pdf.text(data, centerX, dataRowY + 10, { align: 'center' })
    })

    yPos = dataRowY + dataRowHeight + 15
    
    // Billing Summary Section - Simple 3 lines as requested
    yPos += 10
    
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...darkGray)
    pdf.text('BILLING SUMMARY', 20, yPos)
    yPos += 15

    // Simple billing breakdown with past jama + current order format
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...darkGray)
    
    // Get customer's past jama gold (excluding current order)
    let customerPastJama = 0
    try {
      const { getCustomerJamaBalancesCollection } = await import('@/lib/mongodb')
      const jamaBalancesCol = await getCustomerJamaBalancesCollection()
      
      // Get current order ID from bill
      const currentOrderId = bill.orderId || bill.orderDetails?.id
      
      console.log(`🔍 PAST JAMA DEBUG - PDF:`);
      console.log(`   Bill ID: ${id}`);
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
      
      customerPastJama = jamaBalances.reduce((sum, balance) => {
        const goldAmount = balance.goldBalance || balance.jamaGoldAmount || 0
        const returned = balance.returnedAmount || 0
        const pending = Math.max(0, goldAmount - returned)
        console.log(`   Balance: ${goldAmount}g - ${returned}g = ${pending}g (Order: ${balance.orderId || 'Manual'})`);
        return sum + pending
      }, 0)
      
      console.log(`   Total Past Jama: ${customerPastJama}g`);
    } catch (error) {
      console.warn('Could not fetch customer past jama for PDF generation:', error)
      customerPastJama = 0
    }
    
    // Show past jama if exists
    if (customerPastJama > 0) {
      pdf.text(`Past jama order: ${customerPastJama.toFixed(3)}g`, 20, yPos)
      yPos += 8
    }
    
    // Current order
    pdf.text(`Current order: ${totalAmount.toFixed(3)}g`, 20, yPos)
    yPos += 8
    
    // Total
    pdf.setTextColor(217, 119, 6) // Orange color for total
    pdf.setFont('helvetica', 'bold')
    const finalAmount = (totalAmount + customerPastJama).toFixed(3)
    pdf.text(`Total: ${finalAmount}g`, 20, yPos)

    // Footer
    const footerY = pageHeight - 30
    
    // Generation timestamp
    pdf.setFontSize(8)
    pdf.setTextColor(...mediumGray)
    pdf.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 20, footerY)
    
    // Signature section
    pdf.text('For AM JEWELLERS', pageWidth - 60, footerY)
    pdf.text('Authorized Signatory', pageWidth - 60, footerY + 5)
    
    console.log(`✅ Preview-style PDF generated successfully using jsPDF`)

    // Get PDF as buffer
    const pdfBuffer = pdf.output('arraybuffer')

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Bill_${billNumber}_Preview.pdf"`,
        'Content-Length': pdfBuffer.byteLength.toString()
      }
    })

  } catch (error) {
    console.error('Error generating preview PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview PDF' },
      { status: 500 }
    )
  }
}
