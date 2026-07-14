'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Order {
  id: string
  customer: {
    name: string
    phone?: string
  }
  orderType: string
  customerGoldWeight: number
  adminGoldWeight: number
  totalGoldUsed: number
  finalJewelryWeight: number
  manufacturingCost: number
  adminProfitGold: number
  karigarStockAmount?: number
  actualGoldWeight?: number
  totalStoneWeight?: number
  actualFinalWeight?: number
  status: string
  createdAt: string
  processes: Array<{
    id: string
    processType: string
    inputWeight: number
    outputWeight: number
    goldLoss: number
    sequence: number
    createdAt: string
    karigar: {
      id: string
      name: string
      specialty?: string
    }
  }>
  transactions: Array<{
    id: string
    type: string
    amount: number
    description: string
    recoveredGold: number
    createdAt: string
  }>
  orderPhoto?: string
}

interface OrderCompletePageProps {
  orderId: string
}

const OrderCompletePage: React.FC<OrderCompletePageProps> = ({ orderId }) => {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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
        setOrder(data.order)
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
  }, [orderId, router])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const handleCompleteOrder = async () => {
    // Check if this is a partial completion (not all 4 processes done)
    const allProcessTypes = ['FILING', 'FREE_POLISH', 'STONE_SETTING', 'FINAL_POLISH']
    const completedProcessTypes = order!.processes.filter(p => p.outputWeight !== undefined && p.outputWeight > 0).map(p => p.processType)
    const missingProcesses = allProcessTypes.filter(type => !completedProcessTypes.includes(type))

    // Show confirmation dialog if not all processes are complete
    if (missingProcesses.length > 0) {
      const confirmMessage = `⚠️ Early Order Completion\n\n` +
        `This order will be completed after only ${completedProcessTypes.length} of 4 possible manufacturing processes.\n\n` +
        `Completed: ${completedProcessTypes.join(', ')}\n` +
        `Skipped: ${missingProcesses.join(', ')}\n\n` +
        `The final weight and calculations will be based on the last completed process (${completedProcessTypes[completedProcessTypes.length - 1]}).\n\n` +
        `Are you sure you want to complete this order now?`

      if (!confirm(confirmMessage)) {
        return // User cancelled
      }
    }

    setSubmitting(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        // Order completion succeeded – go directly to bill creation page
        await response.json()
        router.push(`/orders/${orderId}/bill/unified`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to complete order')
      }
    } catch (error) {
      console.error('Error completing order:', error)
      alert('Failed to complete order')
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

  if (order.status === 'DELIVERED') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Order already billed and delivered</h2>
        <p className="mt-2 text-gray-600">This order has been completed and billed.</p>
        <Link href={`/orders/${orderId}`} className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
          View Order Details
        </Link>
      </div>
    )
  }

  const totalGoldLoss = order.processes.reduce((sum, p) => sum + p.goldLoss, 0)
  const goldAllocated = order.karigarStockAmount || 0
  const finalProcess = order.processes.find(p => p.processType === 'FINAL_POLISH')
  const actualFinalWeight = order.actualFinalWeight || (finalProcess ? finalProcess.outputWeight : (order.finalJewelryWeight - totalGoldLoss))
  const totalStoneWeight = order.totalStoneWeight || 0
  const actualGoldWeight = order.actualGoldWeight || (actualFinalWeight - totalStoneWeight)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {order.status === 'COMPLETED' ? 'Order Completion Summary' : 'Complete Order'}
          </h1>
          <p className="text-gray-600">Customer: {order.customer.name}</p>
        </div>
        <Link
          href={`/orders/${orderId}`}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium"
        >
          Back to Order
        </Link>
      </div>

      {order.status === 'COMPLETED' ? (
        // Order completed - show summary and billing option
        <>
          {/* Completion Summary */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Order Completed Successfully!</h2>
                <p className="text-gray-600">Manufacturing processes are complete. Ready for billing.</p>
              </div>
            </div>

            {/* Weight Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="text-lg font-medium text-blue-900 mb-3">🏭 Manufacturing Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Gold Allocated:</span>
                    <span className="font-medium">{goldAllocated.toFixed(3)}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Gold Loss:</span>
                    <span className="font-medium text-red-600">{totalGoldLoss.toFixed(3)}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Processes Completed:</span>
                    <span className="font-medium text-green-600">{order.processes.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-md">
                <h3 className="text-lg font-medium text-green-900 mb-3">⚖️ Final Weights</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Final Weight:</span>
                    <span className="font-medium text-blue-600">{actualFinalWeight.toFixed(3)}g</span>
                  </div>
                  {totalStoneWeight > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Stone Weight:</span>
                        <span className="font-medium text-purple-600">{totalStoneWeight.toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Actual Gold Weight:</span>
                        <span className="font-semibold text-green-600">{actualGoldWeight.toFixed(3)}g</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-md">
                <h3 className="text-lg font-medium text-orange-900 mb-3">📦 Stock Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>In-Process Stock:</span>
                    <span className="font-medium text-red-600">Cleared</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Karigar Return Stock:</span>
                    <span className="font-medium text-green-600">{actualGoldWeight.toFixed(3)}g fine</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-medium text-orange-600">Ready for Billing</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Process Details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-3">🔧 Manufacturing Process Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {order.processes.sort((a, b) => a.sequence - b.sequence).map((process) => (
                  <div key={process.id} className="bg-white p-3 rounded border">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 mb-1">{process.processType}</div>
                      <div className="text-gray-600">
                        <div>In: {process.inputWeight.toFixed(3)}g</div>
                        <div>Out: {process.outputWeight.toFixed(3)}g</div>
                        <div className="text-red-600">Loss: {process.goldLoss.toFixed(3)}g</div>
                        <div className="text-blue-600 text-xs">{process.karigar.name}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Billing Action */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">🧾 Create Customer Bill</h3>
              <p className="text-gray-600 mb-6">
                Order manufacturing is complete. Choose your preferred billing method.
              </p>

              <div className="max-w-xl mx-auto">
                {/* Unified Bill Creator */}
                <div className="border-2 border-green-200 rounded-lg p-8 hover:border-green-400 transition-colors bg-gradient-to-r from-green-50 to-blue-50">
                  <div className="text-center mb-6">
                    <h4 className="text-2xl font-bold text-gray-800 mb-3">📋 Create Customer Bill</h4>
                    <p className="text-gray-600 mb-4">
                      Professional bill with live preview, exact format matching your requirements, and PDF download.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                      <div className="space-y-2">
                        <p className="flex items-center"><span className="text-green-600 mr-2">✓</span>Live Preview</p>
                        <p className="flex items-center"><span className="text-green-600 mr-2">✓</span>Exact Layout</p>
                        <p className="flex items-center"><span className="text-green-600 mr-2">✓</span>Order Image</p>
                      </div>
                      <div className="space-y-2">
                        <p className="flex items-center"><span className="text-green-600 mr-2">✓</span>PDF Download</p>
                        <p className="flex items-center"><span className="text-green-600 mr-2">✓</span>3 Rows × 10 Columns</p>
                        <p className="flex items-center"><span className="text-green-600 mr-2">✓</span>Auto Calculations</p>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/orders/${orderId}/bill/unified`}
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-4 rounded-lg font-bold text-lg inline-block w-full text-center shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    💰 Create Customer Bill
                  </Link>
                </div>
              </div>

              <p className="text-sm text-gray-600 mt-6 text-center">
                ✨ New unified bill creator with real-time preview and exact formatting as shown in your requirements
              </p>
            </div>
          </div>
        </>
      ) : (
        // Order not completed yet - show completion interface
        <>
          {/* Order Summary */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Manufacturing Summary</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Left: Order Image */}
              <div className="lg:col-span-1">
                <div className="aspect-square relative rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
                  {order.orderPhoto ? (
                    <img
                      src={order.orderPhoto}
                      alt={order.customer.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm">No Image Available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Gold Allocation & Final Weight */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                      <span className="mr-2">⚖️</span> Gold Allocation
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center p-2 bg-white rounded-lg shadow-sm">
                        <span className="text-gray-600">Gold Allocated</span>
                        <span className="font-bold text-gray-900">{goldAllocated.toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded-lg shadow-sm">
                        <span className="text-gray-600">Total Gold Loss</span>
                        <span className="font-bold text-red-600">-{totalGoldLoss.toFixed(3)}g</span>
                      </div>
                      {totalStoneWeight > 0 && (
                        <div className="flex justify-between items-center p-2 bg-white rounded-lg shadow-sm">
                          <span className="text-gray-600">Total Stone Weight</span>
                          <span className="font-bold text-purple-600">+{totalStoneWeight.toFixed(3)}g</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-green-50 p-5 rounded-xl border border-green-100">
                    <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                      <span className="mr-2">✅</span> Final Status
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center p-2 bg-white rounded-lg shadow-sm">
                        <span className="text-gray-600">Final Weight (with stones)</span>
                        <span className="font-bold text-blue-600 text-lg">{actualFinalWeight.toFixed(3)}g</span>
                      </div>
                      {totalStoneWeight > 0 && (
                        <div className="flex justify-between items-center p-2 bg-white rounded-lg shadow-sm">
                          <span className="text-gray-600">Net Gold Weight</span>
                          <span className="font-bold text-green-600 text-lg">{actualGoldWeight.toFixed(3)}g</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manufacturing Process Details - Side by Side */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">🔧</span> Process Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {order.processes.sort((a, b) => a.sequence - b.sequence).map((process, index) => (
                  <div
                    key={process.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                      <span className="font-semibold text-gray-800 text-sm">{process.processType}</span>
                      <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                        Step {index + 1}
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Input</span>
                        <span className="font-medium text-gray-900">{process.inputWeight.toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Output</span>
                        <span className="font-bold text-blue-600">{process.outputWeight.toFixed(3)}g</span>
                      </div>
                      <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Loss</span>
                        <span className="font-bold text-red-500 text-sm">-{process.goldLoss.toFixed(3)}g</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-100 text-center">
                        <span className="text-xs text-gray-500">Karigar: </span>
                        <span className="text-xs font-medium text-gray-700">{process.karigar.name}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Empty State placeholders if fewer than 4 processes */}
                {Array.from({ length: Math.max(0, 4 - order.processes.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-gray-50 rounded-xl border border-gray-200 border-dashed flex flex-col items-center justify-center p-6 text-gray-400">
                    <span className="text-2xl mb-2">⏳</span>
                    <span className="text-sm">Pending Process</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete Order Button */}
            <div className="text-center pt-6 border-t border-gray-200">
              <button
                onClick={handleCompleteOrder}
                disabled={submitting}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 w-full md:w-auto"
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Completing Order...
                  </span>
                ) : (
                  '✅ Complete Order & Generate Bill'
                )}
              </button>
              <p className="text-sm text-gray-500 mt-3">
                This will finalize the order, clear in-process stock, and move to billing.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default OrderCompletePage
