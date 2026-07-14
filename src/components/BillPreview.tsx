'use client'

import React, { useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface BillPreviewProps {
  order: any & { orderPhoto?: string }
  calculations: any
  billData: any
  billNumber?: string
  onDownload?: () => void
}

const BillPreview: React.FC<BillPreviewProps> = ({ 
  order, 
  calculations, 
  billData, 
  billNumber = "PREVIEW",
  onDownload 
}) => {
  const printRef = useRef<HTMLDivElement>(null)

  const handleDownloadPDF = async () => {
    if (!printRef.current) return

    try {
      const element = printRef.current
      
      // Clone the element and temporarily apply CSS overrides for PDF
      const clonedElement = element.cloneNode(true) as HTMLElement
      clonedElement.style.backgroundColor = '#ffffff'
      clonedElement.style.color = '#000000'
      
      // Override any problematic CSS including oklch colors
      const allElements = clonedElement.querySelectorAll('*')
      allElements.forEach((el: any) => {
        const computedStyle = window.getComputedStyle(el)
        
        // Fix oklch colors and other problematic CSS
        if (computedStyle.backgroundColor.includes('oklch') || computedStyle.backgroundColor.includes('color-mix')) {
          el.style.backgroundColor = '#ffffff'
        }
        if (computedStyle.color.includes('oklch') || computedStyle.color.includes('color-mix')) {
          el.style.color = '#000000'
        }
        if (computedStyle.borderColor && (computedStyle.borderColor.includes('oklch') || computedStyle.borderColor.includes('color-mix'))) {
          el.style.borderColor = '#000000'
        }
        
        // Force remove any CSS custom properties that might use oklch
        el.style.removeProperty('--tw-bg-opacity')
        el.style.removeProperty('--tw-text-opacity')
        el.style.removeProperty('--tw-border-opacity')
        
        // Ensure all colors are standard RGB/hex values
        if (el.classList.contains('bg-blue-600') || el.classList.contains('bg-blue-700')) {
          el.style.backgroundColor = '#2563eb'
        }
        if (el.classList.contains('bg-gray-100')) {
          el.style.backgroundColor = '#f3f4f6'
        }
        if (el.classList.contains('text-gray-900')) {
          el.style.color = '#111827'
        }
        if (el.classList.contains('text-gray-700')) {
          el.style.color = '#374151'
        }
        if (el.classList.contains('border-gray-400')) {
          el.style.borderColor = '#9ca3af'
        }
      })
      
      // Append to body temporarily for rendering
      clonedElement.style.position = 'absolute'
      clonedElement.style.left = '-9999px'
      document.body.appendChild(clonedElement)
      
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        allowTaint: true,
        foreignObjectRendering: true
      })
      
      // Remove the cloned element
      document.body.removeChild(clonedElement)
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const imgWidth = 210
      const pageHeight = 295
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      
      let position = 0
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      const fileName = `Bill_${billNumber}_${(order?.customer?.name || 'Unknown').replace(/\s+/g, '_')}.pdf`
      pdf.save(fileName)
      
      if (onDownload) onDownload()
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const currentDate = new Date().toLocaleDateString('en-IN')

  return (
    <div className="space-y-4">
      {/* Download Button */}
      <div className="flex justify-end">
        <button
          onClick={handleDownloadPDF}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Download PDF</span>
        </button>
      </div>

      {/* Bill Preview */}
      <div 
        ref={printRef}
        className="bg-white p-8 border border-gray-300 shadow-lg max-w-4xl mx-auto"
style={{ minHeight: 'auto' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AM Jwellers</h1>
            <div className="text-sm text-gray-700">
              <p>Shekh Nayem</p>
              <p>Patavadi Chowk</p>
              <p>Phone 9907047429</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-blue-600 text-white p-3 rounded-lg mb-4">
              {order?.orderPhoto ? (
                <img 
                  src={order.orderPhoto} 
                  alt="Order Photo" 
                  className="w-12 h-12 object-cover rounded mx-auto mb-2"
                />
              ) : (
                <div className="w-12 h-12 bg-white/20 rounded mx-auto mb-2"></div>
              )}
            </div>
            <div className="text-sm">
              <p className="font-semibold">INVOICE {billNumber}</p>
              <p>DATE: {currentDate}</p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-8">
          <div className="border-b-2 border-gray-300 pb-2 mb-4">
            <p className="font-bold text-lg">TO:</p>
            <p className="font-semibold">Customer Name: {order?.customer?.name || 'Loading...'}</p>
          </div>
        </div>

        {/* Past Jama Section (if exists) */}
        {billData?.pastPendingAmounts?.totalAmount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <h3 className="text-sm font-bold text-yellow-800 mb-3">📋 Past Jama Gold (Previous Orders)</h3>
            <div className="space-y-2">
              {billData.pastPendingAmounts.details?.map((detail: any, index: number) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-yellow-700">
                    {detail.orderInfo?.orderName || `Order #${detail.orderId.slice(-6)}`}
                  </span>
                  <span className="font-semibold text-red-600">
                    {detail.pendingAmount.toFixed(3)}g
                  </span>
                </div>
              ))}
              <div className="border-t border-yellow-300 pt-2 mt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-yellow-800">Total Past Pending:</span>
                  <span className="text-red-700">
                    {billData.pastPendingAmounts.totalAmount.toFixed(3)}g
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bill Table */}
        <div className="mb-8 overflow-x-auto">
          <table className="w-full border-collapse border border-gray-400 min-w-max">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style={{ width: '7%' }}>Sr</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs font-semibold" style={{ width: '18%' }}>Order Detail</th>
                <th className="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style={{ width: '10%' }}>Net Wt</th>
                <th className="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style={{ width: '10%' }}>Stone</th>
                <th className="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style={{ width: '10%' }}>Ad Wt</th>
                <th className="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style={{ width: '11%' }}>Wastage</th>
                <th className="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style={{ width: '11%' }}>Gross Wt</th>
                <th className="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style={{ width: '11%' }}>Total</th>
                <th className="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style={{ width: '12%' }}>Rupees</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-400 px-1 py-2 text-xs text-center">1</td>
                <td className="border border-gray-400 px-2 py-2 text-xs" style={{ wordBreak: 'break-word' }}>
                  {(order?.orderName || 'Loading...').length > 15 ? (order?.orderName || 'Loading...').substring(0, 15) + '...' : (order?.orderName || 'Loading...')}
                </td>
                <td className="border border-gray-400 px-1 py-2 text-xs text-center">
                  {(calculations?.baseWeightSelected || calculations?.actualGoldWeight || 0).toFixed(2)}g
                </td>
                <td className="border border-gray-400 px-1 py-2 text-xs text-center">
                  {((calculations?.kalesStoneWeight || calculations?.customStoneWeight || 0) !== 0) ? `${Math.abs(calculations?.kalesStoneWeight || calculations?.customStoneWeight || 0).toFixed(2)}g` : '-'}
                </td>
                <td className="border border-gray-400 px-1 py-2 text-xs text-center">
                  {((calculations?.adWeight || calculations?.customAdWeight || 0) !== 0) ? `${Math.abs(calculations?.adWeight || calculations?.customAdWeight || 0).toFixed(2)}g` : '-'}
                </td>
                <td className="border border-gray-400 px-1 py-2 text-xs text-center">
                  {calculations?.makingCharge ? calculations.makingCharge : '-'}
                </td>
                <td className="border border-gray-400 px-1 py-2 text-xs text-center font-medium">
                  {(calculations?.finalBillingWeight || calculations?.actualGoldWeight || 0).toFixed(2)}g
                </td>
                <td className="border border-gray-400 px-1 py-2 text-xs text-center font-bold">
                  {(calculations?.currentOrderOwedFineGold || calculations?.totalCustomerOwedFineGold || 0).toFixed(2)}g
                </td>
                <td className="border border-gray-400 px-1 py-2 text-xs text-center">
                  ₹{billData?.rupees || 0}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Billing Summary Section */}
        <div className="mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">BILLING SUMMARY</h3>
          
          {/* Past Jama Order (if exists) */}
          {billData?.pastPendingAmounts?.totalAmount > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-sm">
                <span>Past jama order:</span>
                <span className="font-medium text-red-600">
                  {billData.pastPendingAmounts.totalAmount.toFixed(3)}g
                </span>
              </div>
            </div>
          )}
          
          {/* Current Order */}
          <div className="mb-2">
            <div className="flex justify-between text-sm">
              <span>Current order:</span>
              <span className="font-medium">
                {(calculations?.currentOrderOwedFineGold || calculations?.totalCustomerOwedFineGold || 0).toFixed(3)}g
              </span>
            </div>
          </div>
          
          {/* Total */}
          <div className="border-t border-gray-300 pt-2">
            <div className="flex justify-between text-base font-bold">
              <span>Total:</span>
              <span className="text-orange-600">
                {((calculations?.currentOrderOwedFineGold || calculations?.totalCustomerOwedFineGold || 0) + 
                  (billData?.pastPendingAmounts?.totalAmount || 0)).toFixed(3)}g
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default BillPreview
