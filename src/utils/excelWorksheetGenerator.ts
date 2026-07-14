import ExcelJS from 'exceljs'
import { getPurityDisplayName, KaratPurity } from '@/lib/gold-conversions'

interface WorksheetData {
  orderNumber: string
  customerName: string
  orderName: string
  selectedKarat: number
  size: string
  totalWeight: string
  unit: string
  date?: string
  deliveryDate?: string
  imageUrl?: string
  adDetails?: { size: string; pieces: string | number; total: string | number }[]
}

export async function generateManufacturingWorksheetExcel(data: WorksheetData): Promise<Buffer> {
  // Helper function to get karat display
  const getKaratDisplay = (karat: number) => {
    const purityName = getPurityDisplayName(karat as KaratPurity)
    // Extract karat number and add KT suffix
    const karatNumber = purityName.split(' ')[0] // "22k" from "22k (92%)"
    return karatNumber.toUpperCase() + 'T' // "22KT"
  }

  // Convert weight to grams for display
  const convertToGrams = (value: string, unit: string) => {
    const numValue = parseFloat(value) || 0
    return unit === 'milligrams' ? (numValue / 1000).toFixed(3) : numValue.toFixed(3)
  }

  const date = data.date || new Date().toLocaleDateString('en-GB')
  const weightInGrams = data.totalWeight ? convertToGrams(data.totalWeight, data.unit) : '0.000'

  // Create a new workbook
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Manufacturing Worksheet')

  // Set exactly 5 columns (A-E) to match the preview exactly
  worksheet.columns = [
    { width: 18 }, // Column A - BAG NO/DATE/Process names
    { width: 15 }, // Column B - AM JEWELLARS part/Customer Name/IN
    { width: 15 }, // Column C - AM JEWELLARS part/ORDER/OUT  
    { width: 15 }, // Column D - AM JEWELLARS part/22KT/LOSS
    { width: 20 }, // Column E - Size/Delivery Date/etc
  ]

  // Row 1: Header - BAG NO- | AM JEWELLARS (merged across B-E)
  worksheet.getCell('A1').value = data.orderNumber || 'BAG NO-'
  worksheet.getCell('B1').value = 'AM JEWELLARS'
  worksheet.mergeCells('B1:E1') // Merge AM JEWELLARS across B-E (4 columns)

  // Row 2: Customer Details Row - DATE- | Customer Name (merged B-C) | ORDER | 22KT
  worksheet.getCell('A2').value = 'DATE-'
  worksheet.getCell('B2').value = 'Customer Name'
  worksheet.mergeCells('B2:C2') // Merge Customer Name across B-C
  worksheet.getCell('D2').value = 'ORDER'
  worksheet.getCell('E2').value = getKaratDisplay(data.selectedKarat)

  // Row 3: Data Row - Date | Customer Name (merged B-C) | Order Name | Size
  worksheet.getCell('A3').value = date
  worksheet.getCell('B3').value = data.customerName || ''
  worksheet.mergeCells('B3:C3') // Merge customer name across B-C
  worksheet.getCell('D3').value = data.orderName || ''
  worksheet.getCell('E3').value = data.size ? `Size - ${data.size}` : ''

  // Row 4: Process Headers - (empty A) | IN | OUT | LOSS | D DATE -
  worksheet.getCell('A4').value = ''
  worksheet.getCell('B4').value = 'IN'
  worksheet.getCell('C4').value = 'OUT'
  worksheet.getCell('D4').value = 'LOSS'
  worksheet.getCell('E4').value = 'D DATE -'

  // Row 5: Delivery date row - empty | empty | empty | empty | delivery date
  worksheet.getCell('E5').value = data.deliveryDate ? new Date(data.deliveryDate).toLocaleDateString('en-GB') : ''

  // Row 6: FAILING Process
  worksheet.getCell('A6').value = 'FAILING'
  
  // Row 7: Empty row after FAILING
  
  // Row 8: F PALISH Process  
  worksheet.getCell('A8').value = 'F PALISH'
  
  // Row 9: Empty row after F PALISH

  // Row 10: SETTING Process
  worksheet.getCell('A10').value = 'SETTING'

  // Row 11: AD Stone Row
  worksheet.getCell('A11').value = 'AD'

  // Row 12: KL Stone Row with WT-
  worksheet.getCell('A12').value = 'KL'
  worksheet.getCell('E12').value = 'WT-'

  // Row 13: TOTAL Row with weight
  worksheet.getCell('A13').value = 'TOTAL'
  worksheet.getCell('E13').value = `${weightInGrams}g`

  // Row 14: Empty with FENESH WT in E
  worksheet.getCell('E14').value = 'FENESH WT'

  // Row 15: PALISH Process
  worksheet.getCell('A15').value = 'PALISH'

  // Row 16: AD Details headers
  worksheet.getCell('A16').value = 'AD SIZE'
  worksheet.getCell('B16').value = 'AD PIS'
  worksheet.getCell('C16').value = 'AD SIZ'
  worksheet.getCell('D16').value = 'AD PIS'
  worksheet.getCell('E16').value = 'TOTAL'

  // Rows 17+: AD Details data (if provided)
  if (data.adDetails && data.adDetails.length > 0) {
    let currentRow = 17
    data.adDetails.forEach((ad, index) => {
      // For pairs, display two AD entries per row
      if (index % 2 === 0) {
        const nextAd = data.adDetails![index + 1]
        
        // Set AD data for this row
        worksheet.getCell(`A${currentRow}`).value = ad.size || ''
        worksheet.getCell(`B${currentRow}`).value = ad.pieces || ''
        worksheet.getCell(`C${currentRow}`).value = nextAd?.size || ''
        worksheet.getCell(`D${currentRow}`).value = nextAd?.pieces || ''
        worksheet.getCell(`E${currentRow}`).value = (Number(ad.total || 0) + Number(nextAd?.total || 0)).toString()
        
        currentRow++
      }
    })
  }

  // Row 18: Empty row

  // Row 19: Empty row

  // Row 20: Empty row

  // Row 21: Empty row

  // Row 22: Empty row

  // Row 23: TOTAL LOSS section - spans across all columns
  worksheet.getCell('A23').value = 'TOTAL LOSS'
  worksheet.mergeCells('A23:E23') // Merge TOTAL LOSS across A-E


  // Add product image if provided - position it in top right like the reference image
  if (data.imageUrl) {
    try {
      // Fetch the image
      const response = await fetch(data.imageUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      
      // Determine image extension from URL or content-type
      let extension: 'png' | 'jpeg' | 'gif' = 'png' // default
      const url = data.imageUrl.toLowerCase()
      if (url.includes('.jpg') || url.includes('.jpeg')) {
        extension = 'jpeg'
      } else if (url.includes('.png')) {
        extension = 'png'
      } else if (url.includes('.gif')) {
        extension = 'gif'
      } else if (url.includes('.webp')) {
        extension = 'png' // ExcelJS doesn't support webp, fallback to png
      }
      
      // Add image to workbook
      const imageId = workbook.addImage({
        buffer: buffer as any,
        extension: extension,
      })
      
      // Position image in top-right area like in the reference image (rows 5-9)
      worksheet.addImage(imageId, {
        tl: { col: 4, row: 4 }, // Column E, Row 5
        br: { col: 6, row: 8 }, // Column G, Row 9
      } as any)
    } catch (error) {
      console.warn('Failed to add product image to Excel:', error)
      // Still continue with Excel generation without the image
    }
  }

  // Styling
  const headerStyle = {
    font: { bold: true, size: 12 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }, // Yellow
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }

  const processStyle = {
    font: { bold: true, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } }, // Light gray
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }

  const cellStyle = {
    font: { size: 10 },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }

  const adStyle = {
    font: { bold: true, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFADD8E6' } }, // Light blue
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }


  // Apply styles with safety checks
  try {
    // Header row styles (Row 1) - Yellow background (A-E only)
    const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1']
    headerCells.forEach(cellAddr => {
      const cell = worksheet.getCell(cellAddr)
      if (cell) {
        Object.assign(cell, headerStyle)
      }
    })

    // Row 2 headers - Gray background (A-E only)
    const row2HeaderCells = ['A2', 'B2', 'C2', 'D2', 'E2']
    row2HeaderCells.forEach(cellAddr => {
      const cell = worksheet.getCell(cellAddr)
      if (cell) {
        Object.assign(cell, {
          font: { bold: true, size: 10 },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }, // Light gray
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      }
    })

    // Row 4 process headers - Gray background
    const row4HeaderCells = ['B4', 'C4', 'D4', 'E4']
    row4HeaderCells.forEach(cellAddr => {
      const cell = worksheet.getCell(cellAddr)
      if (cell) {
        Object.assign(cell, {
          font: { bold: true, size: 10 },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }, // Light gray
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      }
    })

    // Process row styles - updated row numbers
    const processCells = ['A6', 'A8', 'A10', 'A15']
    processCells.forEach(cellAddr => {
      const cell = worksheet.getCell(cellAddr)
      if (cell) {
        Object.assign(cell, processStyle)
      }
    })

    // AD/KL row styles - updated row numbers  
    const adCells = ['A11', 'A12']
    adCells.forEach(cellAddr => {
      const cell = worksheet.getCell(cellAddr)
      if (cell) {
        Object.assign(cell, adStyle)
      }
    })

    // TOTAL row styling
    const totalCell = worksheet.getCell('A13')
    if (totalCell) {
      Object.assign(totalCell, processStyle)
    }

    // AD Details headers styling
    const adHeaderCells = ['A16', 'B16', 'C16', 'D16', 'E16']
    adHeaderCells.forEach(cellAddr => {
      const cell = worksheet.getCell(cellAddr)
      if (cell) {
        Object.assign(cell, {
          font: { bold: true, size: 10 },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }, // Light gray
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      }
    })

    // TOTAL LOSS styling - Row 23
    const totalLossCell = worksheet.getCell('A23')
    if (totalLossCell) {
      Object.assign(totalLossCell, {
        font: { bold: true, size: 10 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }, // Yellow
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
    }

  } catch (error) {
    console.warn('Failed to apply some cell styles:', error)
  }

  // Apply borders to all cells (A-E columns only, up to row 23)
  for (let row = 1; row <= 23; row++) {
    for (let col = 1; col <= 5; col++) { // Only 5 columns A-E
      try {
        const cell = worksheet.getCell(row, col)
        if (cell) {
          if (!cell.style) cell.style = {}
          Object.assign(cell, cellStyle)
        }
      } catch (error) {
        console.warn(`Failed to apply style to cell ${row},${col}:`, error)
      }
    }
  }

  // Set row heights
  worksheet.getRow(1).height = 25
  for (let i = 2; i <= 23; i++) {
    worksheet.getRow(i).height = 20
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as unknown as Buffer
}

export async function downloadManufacturingWorksheetExcel(data: WorksheetData): Promise<void> {
  try {
    const excelBuffer = await generateManufacturingWorksheetExcel(data)
    
    // Create blob and download
    const blob = new Blob([excelBuffer as any], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Manufacturing_Worksheet_${data.orderNumber || 'Order'}_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading Excel worksheet:', error)
    throw new Error('Failed to download Excel worksheet')
  }
}
