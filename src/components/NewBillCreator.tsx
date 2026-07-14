'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import html2pdf from 'html2pdf.js'

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
  size?: string
  imageUrl?: string
  deliveryDate?: string
  processes: Array<{
    id: string
    processType: string
    outputWeight: number
    inputWeight: number
    goldLoss: number
    karigar: {
      name: string
    }
  }>
}

interface BillItem {
  orderDetail: string
  netWeight: string
  kalesStone: string
  adWeight: string
  grossWeight: string
  fineGold: string
  makingCharge: string
  advanceGold: string
  total: string
}

interface NewBillCreatorProps {
  orderId: string
}

const NewBillCreator: React.FC<NewBillCreatorProps> = ({ orderId }) => {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [availableAdvanceGold, setAvailableAdvanceGold] = useState(0)
  
  // Form state for bill details
  const [billData, setBillData] = useState({
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    deliveryDate: '',
    
    // Bill items (3 rows as shown in image)
    items: [
      {
        orderDetail: '',
        netWeight: '0',
        kalesStone: '0',
        adWeight: '0',
        grossWeight: '0',
        fineGold: '0',
        makingCharge: '0',
        advanceGold: '0',
        total: '0'
      },
      {
        orderDetail: '',
        netWeight: '0',
        kalesStone: '0',
        adWeight: '0',
        grossWeight: '0',
        fineGold: '0',
        makingCharge: '0',
        advanceGold: '0',
        total: '0'
      },
      {
        orderDetail: '',
        netWeight: '0',
        kalesStone: '0',
        adWeight: '0',
        grossWeight: '0',
        fineGold: '0',
        makingCharge: '0',
        advanceGold: '0',
        total: '0'
      }
    ] as BillItem[]
  })

  const fetchOrder = useCallback(async () => {
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
        
        // Auto-populate initial data
        setBillData(prev => ({
          ...prev,
          customerName: orderData.customer.name,
          deliveryDate: orderData.deliveryDate || '',
          invoiceNumber: `INVOICE${Date.now()}`,
          items: [
            {
              orderDetail: orderData.orderName || 'Ring',
              netWeight: orderData.actualGoldWeight.toFixed(1),
              kalesStone: (orderData.totalStoneWeight * 0.5).toFixed(1), // Assuming split
              adWeight: (orderData.totalStoneWeight * 0.5).toFixed(1),
              grossWeight: orderData.actualFinalWeight.toFixed(1),
              fineGold: (orderData.actualGoldWeight * (orderData.selectedKarat / 100)).toFixed(2),
              makingCharge: '0.5',
              advanceGold: '0',
              total: ((orderData.actualGoldWeight * (orderData.selectedKarat / 100)) + 0.5).toFixed(1)
            },
            ...prev.items.slice(1)
          ]
        }))
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      alert('Failed to fetch order data')
      router.push('/orders')
    } finally {
      setLoading(false)
    }
  }, [orderId, router])

  const fetchAvailableAdvanceGold = useCallback(async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/inventory', {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const inventoryData = data.success ? data.data : data
        setAvailableAdvanceGold(inventoryData.inventory?.advanceCustomerStock || 0)
      }
    } catch (error) {
      console.error('Error fetching advance gold:', error)
    }
  }, [])

  useEffect(() => {
    fetchOrder()
    fetchAvailableAdvanceGold()
  }, [fetchOrder, fetchAvailableAdvanceGold])

  // Calculate total for an item
  const calculateTotal = (item: BillItem) => {
    const fineGold = parseFloat(item.fineGold) || 0
    const makingCharge = parseFloat(item.makingCharge) || 0
    const advanceGold = parseFloat(item.advanceGold) || 0
    return Math.max(0, fineGold + makingCharge - advanceGold).toFixed(1)
  }

  // Update item and recalculate total
  const updateItem = (index: number, field: keyof BillItem, value: string) => {
    setBillData(prev => {
      const newItems = [...prev.items]
      newItems[index] = { ...newItems[index], [field]: value }
      
      // Auto-calculate total
      if (field !== 'total') {
        newItems[index].total = calculateTotal(newItems[index])
      }
      
      return { ...prev, items: newItems }
    })
  }

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault()
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
          ...billData,
          totalAmount: billData.items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0)
        }),
      })

      if (response.ok) {
        alert('Bill created successfully!')
        router.push(`/orders/${orderId}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create bill')
      }
    } catch (error) {
      console.error('Error creating bill:', error)
      alert('Failed to create bill')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPDF = () => {
    const element = document.getElementById('bill-preview')
    if (!element) {
      alert('Bill preview element not found. Please try again.')
      return
    }
    
    const opt = {
      margin: 1,
      filename: `Bill_${billData.invoiceNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }
    
    html2pdf().set(opt).from(element).save()
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Customer Bill</h1>
          <p className="text-gray-600">Customer: {order.customer.name} • Order: {order.orderName}</p>
        </div>
        <div className="space-x-3">
          <button
            onClick={handleDownloadPDF}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            📄 Download PDF
          </button>
          <Link
            href={`/orders/${orderId}/complete`}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - Form inputs */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">📝 Bill Details</h2>
          
          <form onSubmit={handleSaveBill} className="space-y-4">
            {/* Header Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={billData.invoiceNumber}
                  onChange={(e) => setBillData({ ...billData, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={billData.date}
                  onChange={(e) => setBillData({ ...billData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={billData.customerName}
                  onChange={(e) => setBillData({ ...billData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={billData.deliveryDate}
                  onChange={(e) => setBillData({ ...billData, deliveryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Bill Items */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Bill Items (3 Rows)</h3>
              
              {billData.items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Row {index + 1}</h4>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Order Detail</label>
                      <input
                        type="text"
                        value={item.orderDetail}
                        onChange={(e) => updateItem(index, 'orderDetail', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Net Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.netWeight}
                        onChange={(e) => updateItem(index, 'netWeight', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Kales Stone</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.kalesStone}
                        onChange={(e) => updateItem(index, 'kalesStone', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ad Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.adWeight}
                        onChange={(e) => updateItem(index, 'adWeight', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Gross Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.grossWeight}
                        onChange={(e) => updateItem(index, 'grossWeight', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fine Gold</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.fineGold}
                        onChange={(e) => updateItem(index, 'fineGold', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Making Charge</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.makingCharge}
                        onChange={(e) => updateItem(index, 'makingCharge', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Advance Gold</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.advanceGold}
                        onChange={(e) => updateItem(index, 'advanceGold', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Total</label>
                      <input
                        type="text"
                        value={item.total}
                        readOnly
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50 font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-6 py-3 rounded-md font-medium"
            >
              {submitting ? 'Creating Bill...' : '✅ Create Bill'}
            </button>
          </form>
        </div>

        {/* Right side - Live Preview */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">👁️ Live Preview</h2>
          
          <div id="bill-preview" className="bg-white border-2 border-black max-w-4xl" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
            {/* Header Section */}
            <div className="flex justify-between items-start p-4 border-b-2 border-black">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-center mb-2">AM Jwellers</h1>
                <div className="text-sm">
                  <div>Shekh Nayem</div>
                  <div>Palravadi Chowk</div>
                  <div>Phone 9907047429</div>
                </div>
                <div className="mt-4">
                  <div className="text-sm">TO :</div>
                  <div className="text-sm">Customer <span className="underline">{billData.customerName}</span></div>
                </div>
              </div>
              
              <div className="text-right">
                {/* Order Image */}
                <div className="mb-3">
                  {order.imageUrl ? (
                    <img 
                      src={order.imageUrl} 
                      alt="Order" 
                      className="w-20 h-20 object-cover border-2 border-black"
                    />
                  ) : (
                    <div className="w-20 h-20 border-2 border-black bg-blue-600"></div>
                  )}
                </div>
                <div className="text-sm font-bold">INVOICE {billData.invoiceNumber}</div>
                <div className="text-sm mt-1">
                  DATE: {new Date(billData.date).toLocaleDateString('en-US', { 
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  }).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse" style={{ fontSize: '11px' }}>
              <thead>
                <tr className="bg-white">
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '8%' }}>Sr No.</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '15%' }}>Order Detail</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '10%' }}>Net Weight</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '9%' }}>Kales<br/>Stone</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '9%' }}>Ad Weight</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '10%' }}>GROSS<br/>WEIGHT</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '9%' }}>FINE<br/>GOLD</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '10%' }}>Making<br/>Charge</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '10%' }}>ADVANCE<br/>GOLD</th>
                  <th className="border border-black p-1 text-center font-bold" style={{ width: '10%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {/* First row */}
                <tr>
                  <td className="border border-black p-1 text-center">1</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.orderDetail || ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.netWeight || '0'} gram</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.kalesStone || '0'} gram</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.adWeight || '0'} gram</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.grossWeight || '0'} GRAM</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.fineGold || '0'}</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.makingCharge || '0'} gram</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.advanceGold || '0'}</td>
                  <td className="border border-black p-1 text-center">{billData.items[0]?.total || '0'} G</td>
                </tr>
                
                {/* Empty rows for exactly 3 rows total */}
                <tr>
                  <td className="border border-black p-1 text-center">2</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.orderDetail || ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.netWeight && billData.items[1].netWeight !== '0' ? billData.items[1].netWeight + ' gram' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.kalesStone && billData.items[1].kalesStone !== '0' ? billData.items[1].kalesStone + ' gram' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.adWeight && billData.items[1].adWeight !== '0' ? billData.items[1].adWeight + ' gram' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.grossWeight && billData.items[1].grossWeight !== '0' ? billData.items[1].grossWeight + ' GRAM' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.fineGold && billData.items[1].fineGold !== '0' ? billData.items[1].fineGold : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.makingCharge && billData.items[1].makingCharge !== '0' ? billData.items[1].makingCharge + ' gram' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.advanceGold && billData.items[1].advanceGold !== '0' ? billData.items[1].advanceGold : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[1]?.total && billData.items[1].total !== '0' ? billData.items[1].total + ' G' : ''}</td>
                </tr>
                
                <tr>
                  <td className="border border-black p-1 text-center">3</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.orderDetail || ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.netWeight && billData.items[2].netWeight !== '0' ? billData.items[2].netWeight + ' gram' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.kalesStone && billData.items[2].kalesStone !== '0' ? billData.items[2].kalesStone + ' gram' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.adWeight && billData.items[2].adWeight !== '0' ? billData.items[2].adWeight + ' gram' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.grossWeight && billData.items[2].grossWeight !== '0' ? billData.items[2].grossWeight + ' GRAM' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.fineGold && billData.items[2].fineGold !== '0' ? billData.items[2].fineGold : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.makingCharge && billData.items[2].makingCharge !== '0' ? billData.items[2].makingCharge + ' gram' : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.advanceGold && billData.items[2].advanceGold !== '0' ? billData.items[2].advanceGold : ''}</td>
                  <td className="border border-black p-1 text-center">{billData.items[2]?.total && billData.items[2].total !== '0' ? billData.items[2].total + ' G' : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewBillCreator
