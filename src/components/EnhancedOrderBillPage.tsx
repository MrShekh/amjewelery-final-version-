'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import EnhancedBillTemplate from './EnhancedBillTemplate'

interface Order {
  id: string
  customer: {
    name: string
    phone?: string
  }
  orderType: string
  orderName: string
  actualGoldWeight: number
  totalStoneWeight: number
  actualFinalWeight: number
  selectedKarat: number
  status: string
  orderPhoto?: string
  processes: Array<{
    id: string
    processType: string
    outputWeight: number
    karigar: {
      name: string
    }
  }>
}

interface BillItem {
  srNo: number
  orderDetail: string
  netWeight: string
  kalesStone: string
  adWeight: string
  makingCharge: string
  total: string
}

interface EnhancedOrderBillPageProps {
  orderId: string
}

const EnhancedOrderBillPage: React.FC<EnhancedOrderBillPageProps> = ({ orderId }) => {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Bill form data
  const [billForm, setBillForm] = useState({
    customerName: '',
    phoneNumber: '',
    invoiceNumber: '01',
    items: [
      {
        srNo: 1,
        orderDetail: 'Ring',
        netWeight: '10 gram',
        kalesStone: '0.5 gram',
        adWeight: '0.5 gram', 
        makingCharge: '0.5 gram',
        total: '9.5 gram'
      }
    ] as BillItem[],
    // Summary totals
    totalNetWeight: 0,
    totalKalesStone: 0,
    totalAdWeight: 0,
    totalMakingCharge: 0,
    grandTotal: 0
  })

  const [currentEditingItem, setCurrentEditingItem] = useState<BillItem>({
    srNo: 1,
    orderDetail: '',
    netWeight: '',
    kalesStone: '',
    adWeight: '',
    makingCharge: '',
    total: ''
  })

  useEffect(() => {
    fetchOrder()
  }, [orderId])

  const fetchOrder = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/orders/${orderId}`, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      if (response.ok) {
        const data = await response.json()
        const orderData = data.order
        setOrder(orderData)
        
        // Initialize bill form with order data
        setBillForm(prev => ({
          ...prev,
          customerName: orderData.customer?.name || '',
          phoneNumber: orderData.customer?.phone || '',
          items: [{
            srNo: 1,
            orderDetail: orderData.orderName || 'Ring',
            netWeight: `${orderData.actualGoldWeight?.toFixed(1) || '10'} gram`,
            kalesStone: `${(orderData.totalStoneWeight || 0.5).toFixed(1)} gram`,
            adWeight: '0.5 gram',
            makingCharge: '0.5 gram',
            total: `${(orderData.actualFinalWeight || 9.5).toFixed(1)} gram`
          }]
        }))
        
        // Initialize current editing item
        setCurrentEditingItem({
          srNo: 1,
          orderDetail: orderData.orderName || 'Ring',
          netWeight: `${orderData.actualGoldWeight?.toFixed(1) || '10'} gram`,
          kalesStone: `${(orderData.totalStoneWeight || 0.5).toFixed(1)} gram`,
          adWeight: '0.5 gram',
          makingCharge: '0.5 gram',
          total: `${(orderData.actualFinalWeight || 9.5).toFixed(1)} gram`
        })
      } else {
        const errorData = await response.json()
        console.error('Order not found:', errorData.error)
        alert(errorData.error || 'Order not found')
        router.push('/orders')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      alert('Failed to fetch order data')
      router.push('/orders')
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals whenever items change
  useEffect(() => {
    calculateTotals()
  }, [billForm.items])

  const calculateTotals = () => {
    let totalNet = 0
    let totalKales = 0
    let totalAd = 0
    let totalMaking = 0
    let grandTotal = 0

    billForm.items.forEach(item => {
      // Extract numeric values from strings like "10 gram"
      const netVal = parseFloat(item.netWeight.replace(/[^0-9.]/g, '')) || 0
      const kalesVal = parseFloat(item.kalesStone.replace(/[^0-9.]/g, '')) || 0
      const adVal = parseFloat(item.adWeight.replace(/[^0-9.]/g, '')) || 0
      const makingVal = parseFloat(item.makingCharge.replace(/[^0-9.]/g, '')) || 0
      const totalVal = parseFloat(item.total.replace(/[^0-9.]/g, '')) || 0

      totalNet += netVal
      totalKales += kalesVal
      totalAd += adVal
      totalMaking += makingVal
      grandTotal += totalVal
    })

    setBillForm(prev => ({
      ...prev,
      totalNetWeight: totalNet,
      totalKalesStone: totalKales,
      totalAdWeight: totalAd,
      totalMakingCharge: totalMaking,
      grandTotal: grandTotal
    }))
  }

  const handleFormChange = (field: string, value: string) => {
    setCurrentEditingItem(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateCurrentItem = () => {
    setBillForm(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.srNo === currentEditingItem.srNo ? currentEditingItem : item
      )
    }))
  }

  const addNewItem = () => {
    const newSrNo = billForm.items.length + 1
    const newItem: BillItem = {
      srNo: newSrNo,
      orderDetail: '',
      netWeight: '0 gram',
      kalesStone: '0 gram',
      adWeight: '0 gram',
      makingCharge: '0 gram',
      total: '0 gram'
    }
    
    setBillForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
    
    setCurrentEditingItem(newItem)
  }

  const removeItem = (srNo: number) => {
    if (billForm.items.length > 1) {
      setBillForm(prev => ({
        ...prev,
        items: prev.items
          .filter(item => item.srNo !== srNo)
          .map((item, index) => ({ ...item, srNo: index + 1 }))
      }))
      
      // Set editing to first item
      if (billForm.items.length > 1) {
        const firstItem = billForm.items.find(item => item.srNo !== srNo) || billForm.items[0]
        setCurrentEditingItem({ ...firstItem, srNo: 1 })
      }
    }
  }

  const downloadPDF = async () => {
    if (!printRef.current) return

    try {
      const element = printRef.current
      
      // Import html2pdf dynamically
      const html2pdf = (await import('html2pdf.js')).default
      
      const options = {
        margin: 10,
        filename: `bill-${billForm.invoiceNumber}-${billForm.customerName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: true, dpi: 192, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }

      await html2pdf().set(options).from(element).save()
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const saveBill = async () => {
    setSubmitting(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/orders/${orderId}/enhanced-bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          customerName: billForm.customerName,
          phoneNumber: billForm.phoneNumber,
          invoiceNumber: billForm.invoiceNumber,
          items: billForm.items,
          totals: {
            totalNetWeight: billForm.totalNetWeight,
            totalKalesStone: billForm.totalKalesStone,
            totalAdWeight: billForm.totalAdWeight,
            totalMakingCharge: billForm.totalMakingCharge,
            grandTotal: billForm.grandTotal
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert('Bill saved successfully!')
        // Optional: redirect to bill view page
        // router.push(`/bills/${data.billId}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save bill')
      }
    } catch (error) {
      console.error('Error saving bill:', error)
      alert('Failed to save bill')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Order not found</h2>
        <Link href="/orders" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
          Back to Orders
        </Link>
      </div>
    )
  }

  if (order.status !== 'COMPLETED') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Order not ready for billing</h2>
        <p className="mt-2 text-gray-600">Order must be completed before creating a bill. Current status: <strong>{order.status}</strong></p>
        <div className="mt-4 space-x-4">
          <Link href={`/orders/${orderId}`} className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
            View Order Details
          </Link>
          {order.status !== 'COMPLETED' && order.status !== 'DELIVERED' && (
            <Link href={`/orders/${orderId}/complete`} className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg">
              Complete Order
            </Link>
          )}
        </div>
      </div>
    )
  }

  const billData = {
    customerName: billForm.customerName,
    phoneNumber: billForm.phoneNumber,
    invoiceNumber: billForm.invoiceNumber,
    date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase(),
    orderPhoto: order.orderPhoto,
    items: billForm.items,
    totalNetWeight: billForm.totalNetWeight,
    totalKalesStone: billForm.totalKalesStone,
    totalAdWeight: billForm.totalAdWeight,
    totalMakingCharge: billForm.totalMakingCharge,
    grandTotal: billForm.grandTotal
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enhanced Bill Creator</h1>
              <p className="text-gray-600">Customer: {order.customer.name} • Order: {order.orderName}</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={downloadPDF}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </button>
              <button
                onClick={saveBill}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg font-medium"
              >
                {submitting ? 'Saving...' : 'Save Bill'}
              </button>
              <Link
                href={`/orders/${orderId}`}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium"
              >
                Back to Order
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Form Controls */}
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={billForm.customerName}
                    onChange={(e) => setBillForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={billForm.phoneNumber}
                    onChange={(e) => setBillForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={billForm.invoiceNumber}
                    onChange={(e) => setBillForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Items Management */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Bill Items</h3>
                <button
                  onClick={addNewItem}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  Add Item
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2 mb-4">
                {billForm.items.map((item) => (
                  <div
                    key={item.srNo}
                    className={`p-3 border rounded cursor-pointer ${
                      currentEditingItem.srNo === item.srNo 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setCurrentEditingItem(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{item.srNo}. {item.orderDetail}</span>
                        <p className="text-sm text-gray-600">Total: {item.total}</p>
                      </div>
                      {billForm.items.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeItem(item.srNo)
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Item Editor */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  Editing Item #{currentEditingItem.srNo}
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order Detail</label>
                    <input
                      type="text"
                      value={currentEditingItem.orderDetail}
                      onChange={(e) => handleFormChange('orderDetail', e.target.value)}
                      onBlur={updateCurrentItem}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Net Weight</label>
                      <input
                        type="text"
                        value={currentEditingItem.netWeight}
                        onChange={(e) => handleFormChange('netWeight', e.target.value)}
                        onBlur={updateCurrentItem}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kales Stone</label>
                      <input
                        type="text"
                        value={currentEditingItem.kalesStone}
                        onChange={(e) => handleFormChange('kalesStone', e.target.value)}
                        onBlur={updateCurrentItem}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ad Weight</label>
                      <input
                        type="text"
                        value={currentEditingItem.adWeight}
                        onChange={(e) => handleFormChange('adWeight', e.target.value)}
                        onBlur={updateCurrentItem}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Making Charge</label>
                      <input
                        type="text"
                        value={currentEditingItem.makingCharge}
                        onChange={(e) => handleFormChange('makingCharge', e.target.value)}
                        onBlur={updateCurrentItem}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                    <input
                      type="text"
                      value={currentEditingItem.total}
                      onChange={(e) => handleFormChange('total', e.target.value)}
                      onBlur={updateCurrentItem}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bill Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Net Weight:</span>
                  <span className="font-medium">{billForm.totalNetWeight.toFixed(1)} gram</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Kales Stone:</span>
                  <span className="font-medium">{billForm.totalKalesStone.toFixed(1)} gram</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Ad Weight:</span>
                  <span className="font-medium">{billForm.totalAdWeight.toFixed(1)} gram</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Making Charge:</span>
                  <span className="font-medium">{billForm.totalMakingCharge.toFixed(1)} gram</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Grand Total:</span>
                  <span className="font-bold text-lg">{billForm.grandTotal.toFixed(1)} gram</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Live Preview */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Preview</h3>
            <div className="border rounded-lg overflow-hidden" style={{ height: '800px', overflowY: 'auto' }}>
              <div ref={printRef}>
                <EnhancedBillTemplate billData={billData} showPreview={true} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedOrderBillPage
