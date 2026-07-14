'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatForBilling } from '@/utils/numberUtils'
import { getPurityDisplayName, KaratPurity } from '@/lib/gold-conversions'
import SendWhatsAppButton from './SendWhatsAppButton'
import jsPDF from 'jspdf'

interface BillDetail {
  id: string
  billNo: string
  customerId: string
  userId: string
  organizationId: string
  calculation?: {
    completeOrderWeight: number
    kalesStoneWeight: number
    adWeight: number
    manufacturingCost: number
    removeKalesStone: boolean
    removeAdWeight: boolean
    advanceGoldUsed: number
    finalWeight: number
    remainingBalance: number
  }
  itemDetails: Array<{
    description: string
    particulars: string
    rate: string
  }>
  termsAndConditions?: string
  notes?: string
  status: string
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string
    email: string
  }
  orderId?: string
  // Additional computed fields that might be populated by API
  customer?: {
    name: string
    phone: string
    email?: string
    address?: string
  }
  customerDetails?: {
    name: string
    phone: string
    email?: string
    address?: string
  }
  orderDetails?: {
    id: string
    orderName: string
    orderNumber?: string
    orderPhoto?: string
    actualGoldWeight?: number
    actualFinalWeight?: number
    totalStoneWeight?: number
    selectedKarat?: number
  }
  billing?: {
    actualGoldWeight?: number
    billingWeight?: number
    finalBillingWeight?: number
    baseWeightSelected?: number
    billingWeightInFineGold?: number
    manufacturingCostGrams?: number
    subtotalCustomerOwedFineGold?: number
    advanceGoldUsed?: number
    totalCustomerOwedFineGold?: number
    totalStoneWeight?: number
    manualStoneWeight?: number
    manualAdWeight?: number
    totalCustomStoneWeight?: number
    billingWeightOption?: string
    notes?: string
  }
  processes?: Array<{
    id: string
    processType: string
    inputWeight: number
    outputWeight: number
    goldLoss: number
    sequence: number
    karigar?: {
      name: string
    }
  }>
  orderName?: string
  previewHTML?: string
  transactions?: Array<{
    id: string
    type: string
    amount: number
    description: string
    createdAt: string
  }>
}

interface BillDetailPageProps {
  billId: string
}

const BillDetailPage: React.FC<BillDetailPageProps> = ({ billId }) => {
  const router = useRouter()
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  useEffect(() => {
    fetchBill()
  }, [billId])

  const fetchBill = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/bills/${billId}`, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (response.ok) {
        const data = await response.json()
        setBill(data.bill)
      } else {
        const errorData = await response.json()
        console.error('Bill not found:', errorData.error)
        alert(errorData.error || 'Bill not found')
        router.push('/bills')
      }
    } catch (error) {
      console.error('Error fetching bill:', error)
      alert('Failed to fetch bill data')
      router.push('/bills')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBill = async () => {
    if (!bill) return

    const confirmMessage = `Are you sure you want to delete this bill and its corresponding order?\n\n` +
      `Bill No: ${bill.billNo}\n` +
      `Customer: ${bill.customer?.name || bill.customerDetails?.name || 'Unknown'}\n\n` +
      `⚠️ WARNING: Deleting this bill will also permanently delete the associated order, reverse all stock updates (karigar loss, customer/admin stock additions), and delete the transactions and customer jama balance details.\n\n` +
      `This action cannot be undone!`

    if (!window.confirm(confirmMessage)) return

    try {
      setLoading(true)
      const sessionToken = localStorage.getItem('sessionToken')
      
      const response = await fetch(`/api/bills/${billId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (response.ok) {
        alert('Bill and corresponding order deleted successfully. Stocks have been reverted.')
        router.push('/bills')
      } else {
        const errorData = await response.json()
        alert(`Failed to delete: ${errorData.error || 'Unknown error occurred'}`)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error deleting bill:', error)
      alert('Failed to delete. Please check your network connection.')
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'bg-blue-100 text-blue-800'
      case 'PAID': return 'bg-green-100 text-green-800'
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getKaratDisplayName = (karat?: number) => {
    if (!karat) return getPurityDisplayName(92 as KaratPurity)
    return getPurityDisplayName(karat as KaratPurity)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!bill) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Bill not found</h2>
        <Link href="/bills" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
          Back to Bills
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">Bill Details</h1>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
              {bill.billNo}
            </span>
          </div>
          <p className="text-gray-600">
            Customer: {bill.customer?.name || 'Unknown Customer'} • Order: {bill.orderName || 'N/A'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Bills
          </button>
          {bill.previewHTML && (
            <a
              href={`/api/bills/${bill.id}/preview-pdf`}
              target="_blank"
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Preview PDF
            </a>
          )}
          <button
            onClick={handleDeleteBill}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Bill & Order
          </button>
        </div>
      </div>


      {/* Bill Preview */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Bill Preview</h2>
        </div>
        
        {/* Detailed Bill Information */}
        <div className="space-y-6">
          {/* 1. Order Details */}
          {(bill.orderDetails || bill.orderId) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                <span className="mr-2">📎</span>
                Order Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-700">Order Name</p>
                  <p className="text-lg font-semibold text-blue-900">{bill.orderDetails?.orderName || bill.orderName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Order Number</p>
                  <p className="text-lg font-semibold text-blue-900">{bill.orderDetails?.orderNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Gold Purity</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {bill.orderDetails?.selectedKarat || 92}% ({(((bill.orderDetails?.selectedKarat || 92)/100)*24).toFixed(1)}k)
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Gold Weight (Pure)</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {(bill.orderDetails?.actualGoldWeight || bill.billing?.actualGoldWeight || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Final Weight (with stones)</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {(bill.orderDetails?.actualFinalWeight || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Stone Weight</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {(bill.orderDetails?.totalStoneWeight || bill.billing?.totalStoneWeight || 0).toFixed(3)}g
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. Customer Details */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
              <span className="mr-2">👤</span>
              Customer Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-green-700">Name</p>
                <p className="text-lg font-semibold text-green-900">{bill.customer?.name || bill.customerDetails?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Phone</p>
                <p className="text-lg font-semibold text-green-900">{bill.customer?.phone || bill.customerDetails?.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Email</p>
                <p className="text-lg font-semibold text-green-900">{bill.customer?.email || bill.customerDetails?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Address</p>
                <p className="text-lg font-semibold text-green-900">{bill.customer?.address || bill.customerDetails?.address || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* 3. Stone Weights Breakdown */}
          {(bill.billing || bill.calculation) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                <span className="mr-2">💎</span>
                Stone Weights Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-purple-700">Original Stone Weight</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {(bill.billing?.totalStoneWeight || bill.orderDetails?.totalStoneWeight || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-700">Custom Stone Adjustment</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {(bill.billing?.manualStoneWeight || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-700">Custom AD Weight</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {(bill.billing?.manualAdWeight || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-700">Total Custom Stone Weight</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {(bill.billing?.totalCustomStoneWeight || 0).toFixed(3)}g
                  </p>
                </div>
              </div>
              {bill.billing?.billingWeightOption && (
                <div className="mt-4 p-3 bg-purple-100 rounded">
                  <p className="text-sm font-medium text-purple-700">Billing Method</p>
                  <p className="font-semibold text-purple-900">
                    {bill.billing.billingWeightOption === 'PURE_GOLD_ONLY' 
                      ? '🥇 Pure Gold Only (stones excluded)' 
                      : '📎 Include Stone Weight (stones included in billing)'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 4. Manufacturing Loss (Process-wise) */}
          {bill.processes && bill.processes.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center">
                <span className="mr-2">⚒️</span>
                Manufacturing Process & Loss
              </h3>
              <div className="space-y-3">
                {bill.processes
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((process, index) => (
                    <div key={process.id || index} className="flex items-center justify-between p-3 bg-orange-100 rounded">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-bold text-orange-800">Step {process.sequence || index + 1}:</span>
                        <span className="font-semibold text-orange-900">{process.processType}</span>
                        <span className="text-sm text-orange-700">by {process.karigar?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-blue-600"><strong>In:</strong> {(process.inputWeight || 0).toFixed(3)}g</span>
                        <span className="text-green-600"><strong>Out:</strong> {(process.outputWeight || 0).toFixed(3)}g</span>
                        <span className="text-red-600"><strong>Loss:</strong> {(process.goldLoss || 0).toFixed(3)}g</span>
                      </div>
                    </div>
                  ))
                }
                <div className="mt-4 p-3 bg-orange-200 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-orange-900">Total Manufacturing Loss:</span>
                    <span className="text-xl font-bold text-red-600">
                      {bill.processes.reduce((total, p) => total + (p.goldLoss || 0), 0).toFixed(3)}g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Making Charges Breakdown */}
          {bill.billing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                <span className="mr-2">💰</span>
                Making Charges & Billing Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-yellow-700">Base Weight Selected</p>
                  <p className="text-lg font-semibold text-yellow-900">
                    {(bill.billing.baseWeightSelected || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-700">Final Billing Weight</p>
                  <p className="text-lg font-semibold text-yellow-900">
                    {(bill.billing.finalBillingWeight || bill.billing.billingWeight || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-700">Billing Weight (Fine Gold)</p>
                  <p className="text-lg font-semibold text-yellow-900">
                    {(bill.billing.billingWeightInFineGold || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-700">Manufacturing Cost</p>
                  <p className="text-lg font-semibold text-orange-900">
                    {(bill.billing.manufacturingCostGrams || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-700">Subtotal (Before Advance)</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {(bill.billing.subtotalCustomerOwedFineGold || 0).toFixed(3)}g
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-700">Advance Gold Used</p>
                  <p className="text-lg font-semibold text-green-900">
                    -{(bill.billing.advanceGoldUsed || 0).toFixed(3)}g
                  </p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-yellow-200 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-yellow-900">Final Customer Payment:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {(bill.billing.totalCustomerOwedFineGold || 0).toFixed(3)}g fine gold
                  </span>
                </div>
              </div>
              {bill.billing.notes && (
                <div className="mt-4 p-3 bg-yellow-100 rounded">
                  <p className="text-sm font-medium text-yellow-700">Notes</p>
                  <p className="text-yellow-900">{bill.billing.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Original Bill Preview */}
          {bill.previewHTML ? (
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4 border-b bg-gray-50">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <span className="mr-2">📄</span>
                    Original Bill Preview
                  </h3>
                  <div className="flex items-center space-x-3">
                    <SendWhatsAppButton 
                      billId={bill.id} 
                      customerName={bill.customer?.name || bill.customerDetails?.name}
                      customerPhone={bill.customer?.phone || bill.customerDetails?.phone}
                      size="md"
                    />
                  <button
                    onClick={async () => {
                      setDownloadingPDF(true)
                      try {
                        // Use serverless preview PDF endpoint for consistent formatting
                        const sessionToken = localStorage.getItem('sessionToken')
                        
                        console.log('📄 Downloading PDF using serverless endpoint...');
                        
                        const response = await fetch(`/api/bills/${bill.id}/preview-pdf-serverless`, {
                          method: 'GET',
                          headers: {
                            'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
                          }
                        })
                        
                        if (response.ok) {
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.style.display = 'none'
                          a.href = url
                          const customerName = bill.customer?.name || bill.customerDetails?.name || 'Unknown'
                          a.download = `Bill_${bill.billNo || bill.id}_${customerName.replace(/\s+/g, '_')}.pdf`
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                        } else {
                          const error = await response.text()
                          console.error('PDF download error:', error)
                          alert('Failed to generate PDF: ' + error)
                        }
                      } catch (error) {
                        console.error('Error downloading PDF:', error)
                        alert('Failed to download PDF. Please try again.')
                      } finally {
                        setDownloadingPDF(false)
                      }
                    }}
                    disabled={downloadingPDF}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center space-x-2 ${
                      downloadingPDF 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                  >
                    {downloadingPDF ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Generating PDF...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download PDF (Serverless)</span>
                      </>
                    )}
                  </button>
                    
                    {/* Preview PDF Download Button */}
                    <button
                      onClick={async () => {
                        setDownloadingPDF(true)
                        try {
                          // Use same authentication method as fetchBill function
                          const sessionToken = localStorage.getItem('sessionToken')
                          
                          console.log('📄 Attempting to download preview PDF...');
                          
                          const response = await fetch(`/api/bills/${bill.id}/preview-pdf`, {
                            method: 'GET',
                            headers: {
                              'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
                            }
                          })
                          
                          if (response.ok) {
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.style.display = 'none'
                            a.href = url
                            a.download = `Bill_${bill.billNo || bill.id}_Preview.pdf`
                            document.body.appendChild(a)
                            a.click()
                            window.URL.revokeObjectURL(url)
                          } else {
                            const error = await response.text()
                            console.error('Preview PDF error:', error)
                            alert('Failed to generate preview PDF: ' + error)
                          }
                        } catch (error) {
                          console.error('Error downloading preview PDF:', error)
                          alert('Failed to download preview PDF. Please try again.')
                        } finally {
                          setDownloadingPDF(false)
                        }
                      }}
                      disabled={downloadingPDF}
                      className={`px-4 py-2 rounded-lg font-medium flex items-center space-x-2 ${
                        downloadingPDF 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700'
                      } text-white`}
                    >
                      {downloadingPDF ? (
                        <>
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Download PDF (Puppeteer)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Display the saved preview HTML */}
              <div className="p-4">
                <div 
                  dangerouslySetInnerHTML={{ __html: bill.previewHTML || '' }}
                  className="bill-preview-container"
                />
              </div>
            </div>
          ) : (
            <div className="border border-yellow-200 rounded-lg p-6 bg-yellow-50">
              <h3 className="font-bold text-yellow-700 mb-2">📄 No Preview Available</h3>
              <p className="text-yellow-600">This bill was created without a saved preview. Preview HTML is only available for bills created after this feature was implemented.</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      {bill.transactions && bill.transactions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Transaction History</h2>
          <div className="space-y-3">
            {bill.transactions
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {transaction.type ? transaction.type.replace('_', ' ') : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">{transaction.description || 'No description'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">
                      {transaction.amount.toFixed(3)}g
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BillDetailPage
//hello