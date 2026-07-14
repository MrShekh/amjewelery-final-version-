'use client'

import React, { useState } from 'react'
import BillTemplate from './BillTemplate'
import { generateBillPDF, openBillPDFInNewTab, printBill, BillData } from '../utils/pdfGenerator'

interface BillSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  billData: any
  customerName: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  finalWeight: number
}

const BillSuccessModal: React.FC<BillSuccessModalProps> = ({
  isOpen,
  onClose,
  billData,
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  finalWeight
}) => {
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  if (!isOpen || !billData) return null

  // Prepare bill data for PDF template using the new interface
  const pdfBillData: BillData = {
    customer: {
      name: customerName,
      phone: customerPhone || 'Not provided',
      email: customerEmail || 'Not provided',
      address: customerAddress || 'Not provided'
    },
    order: {
      id: billData.id || 'BILL-ORDER',
      orderName: billData.notes || 'Custom Bill',
      status: 'COMPLETED',
      createdAt: billData.createdAt,
      finalJewelryWeight: finalWeight,
      manufacturingCost: 0 // Bills from this modal are typically for final weight transfer
    },
    billing: {
      goldToReturn: finalWeight,
      manufacturingCostDue: 0,
      goldReturned: 0,
      manufacturingCostPaid: 0,
      goldPending: finalWeight,
      costPending: 0,
      totalBillAmount: 0,
      billingCompleted: false
    },
    processes: [] // No process details for manual bills
  }

  const handleDownloadPDF = async () => {
    try {
      setGeneratingPDF(true)
      const pdfBlob = await generateBillPDF(pdfBillData)
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Bill_${billData.billNo}_${customerName.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleViewPDF = async () => {
    try {
      setGeneratingPDF(true)
      await openBillPDFInNewTab(pdfBillData)
    } catch (error) {
      console.error('Error opening PDF:', error)
      alert('Failed to open PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handlePrint = async () => {
    try {
      setGeneratingPDF(true)
      await printBill(pdfBillData)
    } catch (error) {
      console.error('Error printing:', error)
      alert('Failed to print. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  return (
    <>
      {/* Success Modal */}
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
          <div className="mt-3">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <span className="text-green-600 text-2xl">✅</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Bill Created Successfully!</h3>
              <p className="text-gray-500 mt-2">
                Bill <strong>{billData.billNo}</strong> has been created for <strong>{customerName}</strong>
              </p>
            </div>

            {/* Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-green-800 font-medium">Final Weight:</p>
                  <p className="text-green-900 font-bold text-lg">{finalWeight.toFixed(3)} grams</p>
                </div>
                <div>
                  <p className="text-green-800 font-medium">Bill Number:</p>
                  <p className="text-green-900 font-bold">{billData.billNo}</p>
                </div>
              </div>
            </div>

            {/* Primary Print Action */}
            <div className="mb-6">
              <div className="text-center mb-4">
                <button
                  onClick={handlePrint}
                  disabled={generatingPDF}
                  className="inline-flex items-center px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                >
                  <span className="mr-3 text-xl">🖨️</span>
                  {generatingPDF ? 'Preparing for Print...' : 'Print Bill Now'}
                </button>
              </div>
              <p className="text-center text-sm text-gray-600 mb-4">
                Click above to print the bill immediately, or choose other options below:
              </p>
            </div>

            {/* Additional PDF Options */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Other Options</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                  className="flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="mr-2">📄</span>
                  {generatingPDF ? 'Generating...' : 'Download PDF'}
                </button>
                
                <button
                  onClick={handleViewPDF}
                  disabled={generatingPDF}
                  className="flex items-center justify-center px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="mr-2">👁️</span>
                  {generatingPDF ? 'Generating...' : 'View PDF'}
                </button>
              </div>
            </div>

            {/* Preview Toggle */}
            <div className="mb-6">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {showPreview ? 'Hide Preview' : 'Show Bill Preview'}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bill Preview (Hidden by default, shown for PDF generation) */}
      <div className={`${showPreview ? 'block' : 'hidden'} fixed inset-0 bg-white z-50 overflow-auto`}>
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex justify-between items-center mb-4 no-print">
            <h2 className="text-xl font-bold">Bill Preview</h2>
            <button
              onClick={() => setShowPreview(false)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
            >
              Close Preview
            </button>
          </div>
          <BillTemplate billData={pdfBillData} />
        </div>
      </div>
    </>
  )
}

export default BillSuccessModal
