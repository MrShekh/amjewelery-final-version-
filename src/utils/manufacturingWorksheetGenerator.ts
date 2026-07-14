import jsPDF from 'jspdf'

interface ManufacturingWorksheetData {
  orderId: string
  customerName: string
  orderName: string
  ktSize: string // e.g., "24k"
  size?: string // jewelry size if applicable
  deliveryDate?: string
  orderPhoto?: string
  processes: Array<{
    id: string
    processType: string
    inputWeight: number
    outputWeight: number
    goldLoss: number
    sequence: number
    karigarName: string
  }>
}

export const generateManufacturingWorksheetPDF = async (data: ManufacturingWorksheetData): Promise<Blob> => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 10
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin


  // Header with yellow background
  pdf.setFillColor(255, 255, 0) // Yellow
  pdf.rect(margin, yPosition, contentWidth, 15, 'F')
  pdf.setDrawColor(0, 0, 0)
  pdf.rect(margin, yPosition, contentWidth, 15, 'S')

  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('AM Jwellers', pageWidth / 2, yPosition + 10, { align: 'center' })
  yPosition += 20

  // Column widths for the table layout
  const rowHeight = 8
  const col1Width = 25  // Process name column
  const col2Width = 30  // In column
  const col3Width = 30  // Out column  
  const col4Width = 30  // Loss column
  const col5Width = 25  // Size column
  const col6Width = 30  // D Date column

  // Header row - Date, Customer Name, Order No, KT-24k, Size
  pdf.setFillColor(255, 255, 255) // White background
  
  // First header row
  pdf.rect(margin, yPosition, col1Width, rowHeight)
  pdf.rect(margin + col1Width, yPosition, col2Width + col3Width, rowHeight) // Customer name spans 2 cols
  pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width + col6Width, rowHeight) // KT and Size
  
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Date', margin + 2, yPosition + 5)
  pdf.text('Customer Name', margin + col1Width + 5, yPosition + 5)
  pdf.text('Order.No', margin + col1Width + col2Width + col3Width + 2, yPosition + 5)
  pdf.text(`KT - ${data.ktSize}`, margin + col1Width + col2Width + col3Width + col4Width + 2, yPosition + 5)
  pdf.text('Size', margin + col1Width + col2Width + col3Width + col4Width + col5Width + 2, yPosition + 5)
  yPosition += rowHeight

  // Second header row with values
  pdf.rect(margin, yPosition, col1Width, rowHeight)
  pdf.rect(margin + col1Width, yPosition, col2Width + col3Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width + col6Width, rowHeight)
  
  pdf.text(new Date().toLocaleDateString(), margin + 2, yPosition + 5)
  pdf.text(data.customerName, margin + col1Width + 5, yPosition + 5)
  pdf.text(data.orderId.slice(-6), margin + col1Width + col2Width + col3Width + 2, yPosition + 5)
  pdf.text(data.size || '', margin + col1Width + col2Width + col3Width + col4Width + col5Width + 2, yPosition + 5)
  yPosition += rowHeight

  // Third header row - column labels
  pdf.rect(margin, yPosition, col1Width, rowHeight)
  pdf.rect(margin + col1Width, yPosition, col2Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width, yPosition, col3Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width + col5Width, yPosition, col6Width, rowHeight)

  pdf.text('', margin + 2, yPosition + 5)
  pdf.text('In', margin + col1Width + 12, yPosition + 5)
  pdf.text('Out', margin + col1Width + col2Width + 12, yPosition + 5)
  pdf.text('Loss', margin + col1Width + col2Width + col3Width + 10, yPosition + 5)
  pdf.text('D Date', margin + col1Width + col2Width + col3Width + col4Width + col5Width + 8, yPosition + 5)
  yPosition += rowHeight

  // Add jewelry photo if available (top right corner)
  if (data.orderPhoto) {
    try {
      const photoX = pageWidth - 40
      const photoY = yPosition + 5
      pdf.addImage(data.orderPhoto, 'JPEG', photoX, photoY, 25, 25)
    } catch (error) {
      console.error('Error adding photo:', error)
    }
  }

  // Manufacturing processes with actual data
  const processesData = [
    {
      name: 'Filing',
      data: data.processes.find(p => p.processType.toLowerCase().includes('filing')) || null
    },
    {
      name: 'Free Polish', 
      data: data.processes.find(p => p.processType.toLowerCase().includes('polish') && !p.processType.toLowerCase().includes('final')) || null
    },
    {
      name: 'Setting',
      data: data.processes.find(p => p.processType.toLowerCase().includes('setting') || p.processType.toLowerCase().includes('stone')) || null
    }
  ]

  // Add manufacturing processes
  processesData.forEach((process, index) => {
    // Yellow background for process name
    pdf.setFillColor(255, 255, 0)
    pdf.rect(margin, yPosition, col1Width, rowHeight, 'F')
    pdf.setFillColor(255, 255, 255)
    pdf.rect(margin + col1Width, yPosition, col2Width + col3Width + col4Width + col5Width + col6Width, rowHeight, 'F')
    
    pdf.setDrawColor(0, 0, 0)
    pdf.rect(margin, yPosition, col1Width, rowHeight)
    pdf.rect(margin + col1Width, yPosition, col2Width, rowHeight)
    pdf.rect(margin + col1Width + col2Width, yPosition, col3Width, rowHeight)
    pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
    pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width, rowHeight)
    pdf.rect(margin + col1Width + col2Width + col3Width + col4Width + col5Width, yPosition, col6Width, rowHeight)

    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'normal')
    pdf.text(process.name, margin + 2, yPosition + 5)
    
    // Fill in actual process data if available
    if (process.data) {
      pdf.text(process.data.inputWeight.toFixed(1), margin + col1Width + 12, yPosition + 5)
      pdf.text(process.data.outputWeight.toFixed(1), margin + col1Width + col2Width + 12, yPosition + 5)
      pdf.text(process.data.goldLoss.toFixed(1), margin + col1Width + col2Width + col3Width + 10, yPosition + 5)
    } else {
      // Empty cells for processes not yet completed
      pdf.text('', margin + col1Width + 12, yPosition + 5)
      pdf.text('', margin + col1Width + col2Width + 12, yPosition + 5) 
      pdf.text('', margin + col1Width + col2Width + col3Width + 10, yPosition + 5)
    }
    
    yPosition += rowHeight
  })

  // Empty row
  pdf.setFillColor(255, 255, 255)
  for (let i = 0; i < 6; i++) {
    const xPos = margin + (i === 0 ? 0 : col1Width + (i-1) * col2Width)
    const width = i === 0 ? col1Width : (i === 1 ? col2Width : (i === 2 ? col3Width : (i === 3 ? col4Width : (i === 4 ? col5Width : col6Width))))
    pdf.rect(xPos, yPosition, width, rowHeight)
  }
  yPosition += rowHeight

  // AD weight rows (blue background) - Stone size rows
  const adRows = [
    'Ad 1-10', 'Ad 1-20', 'AD 1-30', 'Ad 1-40', 
    'AD 1-50', 'AD 1-60', 'AD 1-70', 'Ad 1-80'
  ]

  adRows.forEach(adRow => {
    pdf.setFillColor(173, 216, 230) // Light blue
    pdf.rect(margin, yPosition, col1Width, rowHeight, 'F')
    pdf.setFillColor(255, 255, 255)
    pdf.rect(margin + col1Width, yPosition, col2Width + col3Width + col4Width + col5Width + col6Width, rowHeight, 'F')
    
    pdf.setDrawColor(0, 0, 0)
    pdf.rect(margin, yPosition, col1Width, rowHeight)
    pdf.rect(margin + col1Width, yPosition, col2Width, rowHeight)
    pdf.rect(margin + col1Width + col2Width, yPosition, col3Width, rowHeight)
    pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
    pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width, rowHeight)
    pdf.rect(margin + col1Width + col2Width + col3Width + col4Width + col5Width, yPosition, col6Width, rowHeight)

    pdf.text(adRow, margin + 2, yPosition + 5)
    
    // Fill in stone data if available - you could add actual stone weights here
    // For now, we'll leave them empty to be filled manually
    
    yPosition += rowHeight
  })

  // KL row - Karigar Loss
  pdf.setFillColor(255, 255, 255)
  pdf.rect(margin, yPosition, col1Width, rowHeight)
  pdf.rect(margin + col1Width, yPosition, col2Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width, yPosition, col3Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width + col5Width, yPosition, col6Width, rowHeight)

  pdf.text('KL', margin + 2, yPosition + 5)
  
  // Calculate total karigar loss from processes
  const totalKLoss = data.processes.reduce((sum, p) => sum + p.goldLoss, 0)
  if (totalKLoss > 0) {
    pdf.text(totalKLoss.toFixed(1), margin + col1Width + 12, yPosition + 5)
  }
  
  yPosition += rowHeight

  // Total row - Total input weight
  pdf.setFillColor(255, 255, 255)
  pdf.rect(margin, yPosition, col1Width, rowHeight)
  pdf.rect(margin + col1Width, yPosition, col2Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width, yPosition, col3Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width + col5Width, yPosition, col6Width, rowHeight)

  const totalInputWeight = data.processes.reduce((sum, p) => sum + p.inputWeight, 0)
  pdf.text('total', margin + 2, yPosition + 5)
  if (totalInputWeight > 0) {
    pdf.text(totalInputWeight.toFixed(1), margin + col1Width + 12, yPosition + 5)
  }
  yPosition += rowHeight * 2

  // Polish section (yellow background) - Final polish process
  const finalPolishProcess = data.processes.find(p => 
    p.processType.toLowerCase().includes('polish') && 
    (p.processType.toLowerCase().includes('final') || p.sequence === data.processes.length)
  )
  
  pdf.setFillColor(255, 255, 0)
  pdf.rect(margin, yPosition, col1Width, rowHeight, 'F')
  pdf.setFillColor(255, 255, 255)
  pdf.rect(margin + col1Width, yPosition, col2Width + col3Width + col4Width + col5Width + col6Width, rowHeight, 'F')
  
  pdf.setDrawColor(0, 0, 0)
  pdf.rect(margin, yPosition, col1Width, rowHeight)
  pdf.rect(margin + col1Width, yPosition, col2Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width, yPosition, col3Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width + col5Width, yPosition, col6Width, rowHeight)

  pdf.text('Polish', margin + 2, yPosition + 5)
  
  // Fill in final polish data if available
  if (finalPolishProcess) {
    pdf.text(finalPolishProcess.inputWeight.toFixed(1), margin + col1Width + 12, yPosition + 5)
    pdf.text(finalPolishProcess.outputWeight.toFixed(1), margin + col1Width + col2Width + 12, yPosition + 5)
    pdf.text(finalPolishProcess.goldLoss.toFixed(1), margin + col1Width + col2Width + col3Width + 10, yPosition + 5)
  }
  
  yPosition += rowHeight

  // Final total row
  pdf.setFillColor(255, 255, 255)
  pdf.rect(margin, yPosition, col1Width, rowHeight)
  pdf.rect(margin + col1Width, yPosition, col2Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width, yPosition, col3Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width, yPosition, col4Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width, yPosition, col5Width, rowHeight)
  pdf.rect(margin + col1Width + col2Width + col3Width + col4Width + col5Width, yPosition, col6Width, rowHeight)

  pdf.text('', margin + 2, yPosition + 5)
  pdf.text('', margin + col1Width + 12, yPosition + 5)
  pdf.text('Total', margin + col1Width + col2Width + 8, yPosition + 5)
  
  // Calculate total loss from all processes
  const totalLoss = data.processes.reduce((sum, p) => sum + p.goldLoss, 0)
  if (totalLoss > 0) {
    pdf.text(totalLoss.toFixed(1), margin + col1Width + col2Width + col3Width + 10, yPosition + 5)
  }


  return pdf.output('blob')
}

export const printManufacturingWorksheet = async (data: ManufacturingWorksheetData): Promise<void> => {
  try {
    const pdfBlob = await generateManufacturingWorksheetPDF(data)
    const pdfUrl = URL.createObjectURL(pdfBlob)
    
    const printWindow = window.open(pdfUrl, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
        setTimeout(() => {
          printWindow.close()
          URL.revokeObjectURL(pdfUrl)
        }, 1000)
      }
    }
  } catch (error) {
    console.error('Error printing manufacturing worksheet:', error)
    throw new Error('Failed to print manufacturing worksheet')
  }
}

export const downloadManufacturingWorksheet = async (data: ManufacturingWorksheetData): Promise<void> => {
  try {
    const pdfBlob = await generateManufacturingWorksheetPDF(data)
    const pdfUrl = URL.createObjectURL(pdfBlob)
    
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `Manufacturing_Worksheet_${data.orderId}_${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(pdfUrl)
  } catch (error) {
    console.error('Error downloading manufacturing worksheet:', error)
    throw new Error('Failed to download manufacturing worksheet')
  }
}
