import jsPDF from 'jspdf'
import { formatForBilling } from './numberUtils'

export interface BillData {
  customer: {
    name: string
    phone: string
    email: string
    address: string
  }
  order: {
    id: string
    orderName: string
    orderPhoto?: string
    status: string
    createdAt: string
    finalJewelryWeight: number
    manufacturingCost: number
  }
  billing: {
    goldToReturn: number
    manufacturingCostDue: number
    goldReturned: number
    manufacturingCostPaid: number
    goldPending: number
    costPending: number
    totalBillAmount: number
    billingCompleted: boolean
  }
  processes: Array<{
    id: string
    processType: string
    inputWeight: number
    outputWeight: number
    goldLoss: number
    goldRecovered: number
    karigarName: string
  }>
}

// Create PDF directly using jsPDF without html2canvas to avoid oklch issues
const generateBillPDFDirect = (billData: BillData): jsPDF => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

  // Helper function to add text with word wrapping
  const addText = (text: string, x: number, y: number, options: any = {}) => {
    const fontSize = options.fontSize || 12
    const fontStyle = options.fontStyle || 'normal'
    const maxWidth = options.maxWidth || contentWidth
    const color = options.color || [0, 0, 0]
    
    pdf.setFontSize(fontSize)
    pdf.setFont('helvetica', fontStyle)
    pdf.setTextColor(color[0], color[1], color[2])
    
    if (options.align === 'center') {
      pdf.text(text, x + maxWidth / 2, y, { align: 'center' })
    } else if (options.align === 'right') {
      pdf.text(text, x + maxWidth, y, { align: 'right' })
    } else {
      const lines = pdf.splitTextToSize(text, maxWidth)
      pdf.text(lines, x, y)
      return lines.length * fontSize * 0.35 // Return height of text block
    }
    return fontSize * 0.35
  }

  // Helper function to draw a rectangle with color
  const addRect = (x: number, y: number, width: number, height: number, fillColor?: number[], strokeColor?: number[]) => {
    if (fillColor) {
      pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2])
      pdf.rect(x, y, width, height, 'F')
    }
    if (strokeColor) {
      pdf.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2])
      pdf.rect(x, y, width, height, 'S')
    }
  }

  // Blue header section
  addRect(margin, yPosition, contentWidth, 20, [70, 130, 180]) // Steel blue background
  addText('AM JEWELLERS', margin + 3, yPosition + 8, { fontSize: 18, fontStyle: 'bold', color: [255, 255, 255] })
  addText('Date', margin + contentWidth - 30, yPosition + 8, { fontSize: 10, color: [255, 255, 255] })
  yPosition += 25

  // Date value
  addText(new Date().toLocaleDateString(), margin + contentWidth - 30, yPosition, { fontSize: 10 })
  yPosition += 15

  // Invoice number
  addText(`INVOICE #${billData.order.id.slice(-4)}`, margin, yPosition, { fontSize: 14, fontStyle: 'bold', color: [70, 130, 180] })
  yPosition += 15

  // Customer Information Section (Left) and Jama Gold Section (Right)
  const leftWidth = contentWidth * 0.6
  const rightWidth = contentWidth * 0.38
  const rightX = margin + leftWidth + 5
  
  // Customer section with border
  addRect(margin, yPosition, leftWidth, 40, undefined, [150, 150, 150])
  addRect(rightX, yPosition, rightWidth, 40, [220, 230, 240], [150, 150, 150]) // Light blue background
  
  // Bill To header
  addRect(margin, yPosition, leftWidth, 8, [220, 230, 240], [150, 150, 150])
  addText('Bill to', margin + 2, yPosition + 5, { fontSize: 10, fontStyle: 'bold' })
  
  // Jama Gold header
  addText('Jama Gold', rightX + 2, yPosition + 5, { fontSize: 10, fontStyle: 'bold' })
  yPosition += 12
  
  // Customer details
  addText(`Customer: ${billData.customer.name}`, margin + 2, yPosition, { fontSize: 10 })
  yPosition += 5
  addText(`Customer ID#: ${billData.order.id.slice(-6)}`, margin + 2, yPosition, { fontSize: 10 })
  yPosition += 5
  addText(`Address: ${billData.customer.address}`, margin + 2, yPosition, { fontSize: 10 })
  yPosition += 5
  addText(`Phone: ${billData.customer.phone}`, margin + 2, yPosition, { fontSize: 10 })
  
  yPosition += 20
  
  // Delivery Date section
  addText('Delivery Date', rightX + 2, yPosition, { fontSize: 10, fontStyle: 'bold' })
  addText(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), rightX + 40, yPosition, { fontSize: 10 })
  yPosition += 25

  // Items table header with blue background
  const tableY = yPosition
  const colWidths = [15, 60, 40, 40, 35]
  const colPositions = [margin]
  for (let i = 1; i < colWidths.length; i++) {
    colPositions.push(colPositions[i - 1] + colWidths[i - 1])
  }
  
  // Table header with blue background
  addRect(margin, yPosition, contentWidth, 10, [70, 130, 180])
  const headers = ['Item#', 'Description', 'Final weight', 'Total', '']
  headers.forEach((header, index) => {
    if (index < colPositions.length) {
      addText(header, colPositions[index] + 2, yPosition + 6, { fontSize: 10, fontStyle: 'bold', color: [255, 255, 255] })
    }
  })
  yPosition += 15

  // Table rows with alternating colors - use current order amounts only
  const currentOrderTotal = billData.billing.goldPending // Current order only
  const items = [
    { item: '1', desc: billData.order.orderName, weight: formatForBilling(billData.order.finalJewelryWeight), total: formatForBilling(currentOrderTotal) },
    { item: '', desc: 'Kales stone', weight: '300 M', total: '8.7' },
    { item: '', desc: 'AD', weight: '200 M', total: '8.5' },
    { item: '', desc: 'Making charge (manufacturing cost)', weight: `₹${formatForBilling(billData.order.manufacturingCost)}`, total: formatForBilling(billData.order.manufacturingCost) }
  ]
  
  items.forEach((item, index) => {
    const rowColor = index % 2 === 0 ? [245, 245, 245] : [255, 255, 255]
    addRect(margin, yPosition, contentWidth, 10, rowColor)
    
    // Add borders
    addRect(margin, yPosition, contentWidth, 10, undefined, [200, 200, 200])
    
    addText(item.item, colPositions[0] + 2, yPosition + 6, { fontSize: 9 })
    addText(item.desc, colPositions[1] + 2, yPosition + 6, { fontSize: 9 })
    addText(item.weight, colPositions[2] + 2, yPosition + 6, { fontSize: 9 })
    addText(item.total, colPositions[3] + 2, yPosition + 6, { fontSize: 9 })
    
    yPosition += 10
  })

  yPosition += 10
  
  // Total section with blue background - show current order total only
  addRect(margin, yPosition, contentWidth, 12, [70, 130, 180])
  addText('A', colPositions[2] + 2, yPosition + 7, { fontSize: 11, fontStyle: 'bold', color: [255, 255, 255] })
  addText('Total', colPositions[3] + 2, yPosition + 7, { fontSize: 11, fontStyle: 'bold', color: [255, 255, 255] })
  addText(formatForBilling(currentOrderTotal), colPositions[4] + 2, yPosition + 7, { fontSize: 11, fontStyle: 'bold', color: [255, 255, 255] })
  yPosition += 25
  
  // Billing details section - Simple 3 lines as requested
  addText('Billing Summary:', margin, yPosition, { fontSize: 12, fontStyle: 'bold', color: [70, 130, 180] })
  yPosition += 15
  
  // Simple billing breakdown
  addText(`Order Weight: ${formatForBilling(billData.order.finalJewelryWeight)}g`, margin, yPosition, { fontSize: 11 })
  yPosition += 8
  
  addText(`Manufacturing Cost: ${formatForBilling(billData.billing.manufacturingCostDue)}g`, margin, yPosition, { fontSize: 11 })
  yPosition += 8
  
  addText(`Total Bill Amount: ${formatForBilling(billData.billing.totalBillAmount)}g`, margin, yPosition, { fontSize: 11, fontStyle: 'bold', color: [200, 100, 0] })
  yPosition += 15

  // Manufacturing Process Details (if exists) - simplified for invoice template
  if (billData.processes.length > 0) {
    addText('Manufacturing Details:', margin, yPosition, { fontSize: 11, fontStyle: 'bold', color: [70, 130, 180] })
    yPosition += 8
    
    billData.processes.slice(0, 3).forEach(process => { // Show max 3 processes
      addText(`${process.processType} by ${process.karigarName}: ${formatForBilling(process.inputWeight)}g → ${formatForBilling(process.outputWeight)}g`, margin + 5, yPosition, { fontSize: 9 })
      yPosition += 5
    })
    yPosition += 10
  }

  // Thank you message matching template
  yPosition += 20
  addText('Thank you for your business!', margin, yPosition, { fontSize: 12, fontStyle: 'bold', color: [70, 130, 180] })
  
  // Footer space
  yPosition += 30

  return pdf
}

export const generateBillPDF = async (billData: BillData): Promise<Blob> => {
  try {
    const pdf = generateBillPDFDirect(billData)
    return pdf.output('blob')
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate PDF')
  }
}

export const openBillPDFInNewTab = async (billData: BillData): Promise<void> => {
  try {
    const pdf = generateBillPDFDirect(billData)
    const pdfBlob = pdf.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
  } catch (error) {
    console.error('Error opening PDF:', error)
    throw new Error('Failed to open PDF')
  }
}

export const printBill = async (billData: BillData): Promise<void> => {
  try {
    // Create a simple HTML template for printing
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      throw new Error('Could not open print window')
    }

    // Create simple HTML structure for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Bill</title>
          <meta charset="UTF-8">
          <style>
            body { 
              margin: 0; 
              padding: 20px;
              font-family: Arial, sans-serif; 
              background: white;
              color: black;
              font-size: 14px;
              line-height: 1.4;
            }
            
            .header {
              text-align: center;
              border: 2px solid black;
              padding: 20px;
              margin-bottom: 20px;
            }
            
            .section {
              border: 1px solid black;
              padding: 15px;
              margin-bottom: 15px;
            }
            
            .section h3 {
              margin: 0 0 10px 0;
              font-size: 16px;
            }
            
            .row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
            }
            
            table { 
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            
            th, td { 
              border: 1px solid black;
              padding: 8px;
              text-align: left;
            }
            
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            .highlight {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            @media print {
              body { font-size: 12px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AM JEWELLERS</h1>
            <p>Professional Jewelry Manufacturing</p>
            <div style="text-align: right; margin-top: 10px;">
              <p>Date: ${new Date().toLocaleDateString()}</p>
              <p>Order ID: #${billData.order.id.slice(-8)}</p>
            </div>
          </div>
          
          <div class="section">
            <h3>Customer Information</h3>
            <div class="row">
              <div>
                <p><strong>Name:</strong> ${billData.customer.name}</p>
                <p><strong>Phone:</strong> ${billData.customer.phone}</p>
              </div>
              <div>
                <p><strong>Email:</strong> ${billData.customer.email}</p>
                <p><strong>Address:</strong> ${billData.customer.address}</p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3>Order Information</h3>
            <div class="row">
              <div>
                <p><strong>Order Name:</strong> ${billData.order.orderName}</p>
                <p><strong>Status:</strong> ${billData.order.status}</p>
              </div>
              <div>
                <p><strong>Final Weight:</strong> ${formatForBilling(billData.order.finalJewelryWeight)}g</p>
                <p><strong>Manufacturing Cost:</strong> ₹${formatForBilling(billData.order.manufacturingCost)}</p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3>Billing Summary</h3>
            <table>
              <tr><td colspan="2" style="background-color: #e9ecef; font-weight: bold;">CURRENT ORDER</td></tr>
              <tr><td>This Order Gold Weight</td><td>${formatForBilling(billData.billing.goldPending)}g</td></tr>
              <tr><td>Manufacturing Cost</td><td>${formatForBilling(billData.billing.manufacturingCostDue)}g</td></tr>
              <tr class="highlight" style="background-color: #f8d7da; border-color: #dc3545;"><td><strong>TOTAL TO COLLECT</strong></td><td><strong style="color: red;">${formatForBilling(billData.billing.totalBillAmount)}g</strong></td></tr>
            </table>
          </div>
          
          ${billData.processes.length > 0 ? `
          <div class="section">
            <h3>Manufacturing Process Details</h3>
            <table>
              <thead>
                <tr>
                  <th>Process</th>
                  <th>Karigar</th>
                  <th>Input (g)</th>
                  <th>Output (g)</th>
                  <th>Loss (g)</th>
                  <th>Recovered (g)</th>
                </tr>
              </thead>
              <tbody>
                ${billData.processes.map(process => `
                  <tr>
                    <td>${process.processType}</td>
                    <td>${process.karigarName}</td>
                    <td>${formatForBilling(process.inputWeight)}</td>
                    <td>${formatForBilling(process.outputWeight)}</td>
                    <td>${formatForBilling(process.goldLoss)}</td>
                    <td>${formatForBilling(process.goldRecovered)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <div class="section">
            <h3>Terms and Conditions:</h3>
            <p>1. Please verify all details before accepting the order.</p>
            <p>2. Any discrepancy should be reported within 24 hours.</p>
            <p>3. Payment terms as per agreement.</p>
            <p>4. Gold purity and weight as per final assay.</p>
          </div>
          
          <div style="text-align: right; margin-top: 40px;">
            <div style="border-top: 1px solid black; width: 200px; margin-left: auto; padding-top: 10px;">
              <p><strong>Authorized Signature</strong></p>
              <p>AM JEWELLERS</p>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 2000);
              }, 500);
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  } catch (error) {
    console.error('Error printing bill:', error)
    throw new Error('Failed to print bill')
  }
}
