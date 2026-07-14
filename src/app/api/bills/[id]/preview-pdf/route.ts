import { NextRequest, NextResponse } from 'next/server'
import { getBillsCollection, getUsersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import puppeteer from 'puppeteer'
// GET /api/bills/[id]/preview-pdf - Generate PDF from bill preview HTML
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

    // Check if bill has preview HTML
    if (!bill.previewHTML) {
      return NextResponse.json(
        { error: 'Bill preview not available. This bill was created before the preview feature was implemented.' },
        { status: 400 }
      )
    }

    // Generate PDF using bill data to ensure completeness (instead of stored HTML)
    const billNumber = bill.billNumber || bill.billNo || `Bill-${bill._id.toString().slice(-6)}`
    const customerName = bill.customerDetails?.name || bill.customer?.name || 'Unknown Customer'
    const orderName = bill.orderName || bill.orderDetails?.orderName || 'ring4'

    console.log(`📄 Generating PDF from bill data: ${billNumber}`);

    // Get order image URL if available
    const orderImageUrl = bill.orderDetails?.orderPhoto || (bill as any).orderPhoto || null

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Bill ${billNumber}</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              background: white;
              color: black;
              font-size: 14px;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
            }
            
            .company-info h1 {
              font-size: 24px;
              font-weight: bold;
              margin: 0;
              color: #1a1a1a;
            }
            
            .company-info p {
              margin: 5px 0;
              font-size: 12px;
              color: #666;
            }
            
            .invoice-info {
              text-align: right;
            }
            
            .invoice-box {
              background-color: #2563eb;
              color: white;
              padding: 20px;
              border-radius: 8px;
              display: inline-block;
              position: relative;
            }
            
            .order-image {
              width: 60px;
              height: 60px;
              object-fit: cover;
              border-radius: 4px;
              background: white;
              padding: 2px;
            }
            
            .invoice-number {
              font-size: 14px;
              font-weight: bold;
              margin-top: 10px;
            }
            
            .invoice-date {
              font-size: 12px;
              margin-top: 5px;
            }
            
            .customer-section {
              margin: 30px 0;
            }
            
            .customer-section h3 {
              font-size: 16px;
              font-weight: bold;
              margin: 0 0 5px 0;
            }
            
            .customer-name {
              font-size: 14px;
              margin: 5px 0;
              border-bottom: 1px solid #ccc;
              padding-bottom: 10px;
            }
            
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin: 20px 0;
              font-size: 12px;
            }
            
            th, td { 
              border: 1px solid #666; 
              padding: 8px 6px; 
              text-align: center;
            }
            
            th { 
              background-color: #f5f5f5; 
              font-weight: bold;
            }
            
            .billing-summary {
              margin-top: 30px;
            }
            
            .billing-summary h3 {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            
            .final-payment {
              color: #d97706;
              font-weight: bold;
            }
            
            .footer {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              color: #666;
            }
            
            .footer .signature {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>AM Jwellers</h1>
              <p>Shekh Nayem</p>
              <p>Patavadi Chowk</p>
              <p>Phone 9907047429</p>
            </div>
            
            <div class="invoice-info">
              <div class="invoice-box">
                ${orderImageUrl ? `<img src="${orderImageUrl}" alt="Order" class="order-image" />` : `
                  <div style="width: 60px; height: 60px; background: white; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #666; text-align: center;">
                    ORDER<br/>PHOTO
                  </div>
                `}
                <div class="invoice-number">INVOICE ${billNumber}</div>
                <div class="invoice-date">DATE: ${new Date().toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          </div>
          
          <div class="customer-section">
            <h3>TO:</h3>
            <div class="customer-name">Customer Name: ${customerName}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Sr</th>
                <th>Order</th>
                <th>Net</th>
                <th>Stone</th>
                <th>Ad Wt</th>
                <th>Wastage</th>
                <th>Gross</th>
                <th>Total</th>
                <th>Rupees</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>${orderName}</td>
                <td>${(bill.billing?.baseWeightSelected || bill.billing?.actualGoldWeight || 11.00).toFixed(2)}g</td>
                <td>-</td>
                <td>${(bill.billing?.manualAdWeight || 0) > 0 ? (bill.billing?.manualAdWeight || 0).toFixed(2) + 'g' : '-'}</td>
                <td>${bill.billing?.makingCharge || '-'}</td>
                <td>${(bill.billing?.finalBillingWeight || bill.billing?.billingWeight || 11.00).toFixed(2)}g</td>
                <td>${(bill.billing?.totalCustomerOwedFineGold || 12.06).toFixed(2)}g</td>
                <td>₹${bill.billing?.rupees || 0}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="billing-summary">
            <h3>BILLING SUMMARY</h3>
            
            ${bill.pastPendingAmounts && bill.pastPendingAmounts.totalAmount > 0 ? `
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between; font-size: 14px;">
              <span>Past jama order:</span>
              <span style="color: #dc2626; font-weight: 500;">${bill.pastPendingAmounts.totalAmount.toFixed(3)}g</span>
            </div>
            ` : ''}
            
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between; font-size: 14px;">
              <span>Current order:</span>
              <span style="font-weight: 500;">${(bill.billing?.totalCustomerOwedFineGold || 0).toFixed(3)}g</span>
            </div>
            
            <div style="border-top: 1px solid #d1d5db; padding-top: 8px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
              <span>Total:</span>
              <span style="color: #d97706;">${((bill.billing?.totalCustomerOwedFineGold || 0) + (bill.pastPendingAmounts?.totalAmount || 0)).toFixed(3)}g</span>
            </div>
          </div>
          
          <div class="footer">
            <div>Generated on: ${new Date().toLocaleString('en-IN')}</div>
            <div class="signature">
              <div>For AM JEWELLERS</div>
              <div style="margin-top: 5px;">Authorized Signatory</div>
            </div>
          </div>
        </body>
      </html>
    `

    console.log(`📄 Starting PDF generation using Puppeteer for bill: ${bill.billNumber || bill.billNo}`);

    let browser
    try {
      // Launch puppeteer with more robust configuration
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--allow-running-insecure-content',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        timeout: 30000
      })

      console.log(`🌐 Browser launched successfully`);

      const page = await browser.newPage()

      // Set viewport and other page settings
      await page.setViewport({ width: 1200, height: 800 })

      console.log(`📄 Setting HTML content...`);

      // Set content with timeout and wait for network idle
      await page.setContent(fullHtml, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 10000
      })

      console.log(`🖺️ Generating PDF...`);

      // Generate PDF with optimized settings
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        },
        timeout: 30000
      })

      console.log(`✅ PDF generated successfully, size: ${pdfBuffer.length} bytes`);

      return new Response(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Bill_${bill.billNumber || bill.billNo}_Preview.pdf"`,
          'Content-Length': pdfBuffer.length.toString()
        }
      })

    } catch (pdfError) {
      console.error(`❌ PDF Generation Error:`, pdfError);
      const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown error occurred';
      throw new Error(`Failed to generate PDF: ${errorMessage}`)
    } finally {
      if (browser) {
        await browser.close()
        console.log(`🔒 Browser closed`);
      }
    }

  } catch (error) {
    console.error('Error in preview HTML generation:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview HTML' },
      { status: 500 }
    )
  }
}
