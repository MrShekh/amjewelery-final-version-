'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ManufacturingWorksheetPreview from './ManufacturingWorksheetPreview'
import { downloadManufacturingWorksheetExcel } from '@/utils/excelWorksheetGenerator'
import { getPurityDisplayName } from '@/lib/gold-conversions'
import useCustomDialogs from '@/hooks/useCustomDialogs'

interface Order {
  id: string
  customerId: string
  orderNumber?: string
  orderName?: string
  orderPhoto?: string // Order image URL
  size?: string // Order size
  deliveryDate?: string // Delivery date for the order
  customer: {
    name: string
    phone?: string
  }
  orderType: string
  customerGoldWeight: number
  adminGoldWeight: number
  totalGoldUsed: number
  finalJewelryWeight: number
  actualFinalWeight?: number
  actualGoldWeight?: number
  totalStoneWeight?: number
  manufacturingCost: number
  adminProfitGold: number
  status: string
  createdAt: string
  selectedKarat?: number // Karat purity (92, 88, 80, 76, 75.5, 75, 59, 37.5)
  customerProvidedGold?: boolean // Whether customer provided gold
  customerAdvanceGold?: number // Amount of advance gold provided by customer
  karigarStockAmount?: number // Original stock allocated
  goldCollectedFromCustomer?: boolean // Whether gold has been collected from customer for this order
  totalCustomerOwedFineGold?: number // Amount customer owes in fine gold after billing
  adDetails?: { size: string; pieces: number; total: number }[] // AD Details array
  processes: Array<{
    id: string
    processType: string
    inputWeight: number
    outputWeight: number
    goldLoss: number
    sequence: number
    status?: string
    createdAt: string
    karigar: {
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
}

interface OrderDetailPageProps {
  orderId: string
}

const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ orderId }) => {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [billInfo, setBillInfo] = useState<{ id: string, billNumber: string } | null>(null)

  // Custom dialogs hook
  const { confirm, success, error, warning } = useCustomDialogs()

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

        // If order is delivered, fetch bill information
        if (data.order.status === 'DELIVERED') {
          fetchBillInfo(orderId)
        }
      } else {
        const errorData = await response.json()
        console.error('Order not found:', errorData.error)
        // Use alert as fallback to avoid hook issues during initial load
        alert(errorData.error || 'Order not found')
        router.push('/orders')
      }
    } catch (fetchError) {
      console.error('Error fetching order:', fetchError)
      // Use alert as fallback to avoid hook issues during initial load
      alert('Failed to fetch order data')
      router.push('/orders')
    } finally {
      setLoading(false)
    }
  }, [orderId, router])

  const fetchBillInfo = async (orderIdForBill: string) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/bills', {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (response.ok) {
        const data = await response.json()
        const orderBill = data.bills.find((bill: any) => bill.orderId === orderIdForBill)
        if (orderBill) {
          setBillInfo({ id: orderBill.id, billNumber: orderBill.billNumber })
        }
      }
    } catch (error) {
      console.error('Error fetching bill info:', error)
    }
  }

  const handleDeleteOrder = async () => {
    if (!order) return

    const isDelivered = order.status === 'DELIVERED'
    // Show confirmation dialog with OK/Cancel buttons
    const confirmMessage = `Are you sure you want to delete this order?\n\n` +
      `Order: ${order.orderName || 'Unnamed Order'}\n` +
      `Customer: ${order.customer.name}\n` +
      `Status: ${order.status}\n\n` +
      (isDelivered
        ? `⚠️ WARNING: This order has been BILLED. Deleting it will also delete the associated customer bill, reverse all customer/admin stock updates, and delete the gold transactions and jama balance details.\n\n`
        : '') +
      `This action cannot be undone! All processes and data related to this order will be permanently deleted.`

    const confirmed = await confirm(
      'Delete Order',
      confirmMessage,
      'error',
      'OK',
      'Cancel'
    )

    if (!confirmed) return

    try {
      setLoading(true)
      const sessionToken = localStorage.getItem('sessionToken')

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (response.ok) {
        const result = await response.json()
        await success('Order Deleted', result.message)
        router.push('/orders')
      } else {
        const errorData = await response.json()
        await error('Delete Failed', `Failed to delete order: ${errorData.error || 'Unknown error occurred'}`)
      }
    } catch (deleteError) {
      console.error('Error deleting order:', deleteError)
      await error('Connection Error', 'Failed to delete order. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCollectOrderGold = async () => {
    if (!order) return

    try {
      setLoading(true)
      const sessionToken = localStorage.getItem('sessionToken')

      // Calculate the actual pending gold that needs to be collected
      const fineGoldAmount = (order.actualGoldWeight || 0) * ((order.selectedKarat || 92) / 100)
      const makingCharges = 1.935 // TODO: Get this from billing data
      const advanceGold = order.customerAdvanceGold || 0
      const totalRequired = fineGoldAmount + makingCharges
      const actualPendingGold = Math.max(0, totalRequired - advanceGold)

      if (actualPendingGold <= 0) {
        await warning('No Pending Gold', 'No pending gold to collect for this order.')
        return
      }

      // Use a direct admin stock addition API instead of the jama gold flow
      // This prevents duplication and directly adds to admin stock
      const collectResponse = await fetch('/api/admin/collect-order-gold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          orderId: order.id,
          customerId: order.customerId,
          goldAmount: actualPendingGold,
          description: `Gold collection from ${order.customer.name} for order "${order.orderName}" (#${order.id.slice(-8)}): ${actualPendingGold.toFixed(3)}g fine gold (Fine: ${fineGoldAmount.toFixed(3)}g + Making: ${makingCharges.toFixed(3)}g - Advance: ${advanceGold.toFixed(3)}g)`,
          orderGoldDetails: {
            fineGold: fineGoldAmount,
            makingCharges: makingCharges,
            advanceGold: advanceGold,
            totalRequired: totalRequired,
            pendingAmount: actualPendingGold
          }
        })
      })

      console.log('Collection response status:', collectResponse.status)
      console.log('Collection response headers:', Object.fromEntries(collectResponse.headers.entries()))

      if (!collectResponse.ok) {
        const responseText = await collectResponse.text()
        console.error('Collection API error response:', responseText)

        try {
          const error = JSON.parse(responseText)
          throw new Error(error.error || `API Error: ${collectResponse.status}`)
        } catch (parseError) {
          throw new Error(`Server returned ${collectResponse.status}: ${responseText.substring(0, 200)}...`)
        }
      }

      const result = await collectResponse.json()
      await success(
        'Gold Collection Successful!',
        `Collected: ${actualPendingGold.toFixed(3)}g fine gold\n` +
        `Fine Gold: ${fineGoldAmount.toFixed(3)}g\n` +
        `Making Charges: ${makingCharges.toFixed(3)}g\n` +
        `Advance Gold Deducted: ${advanceGold.toFixed(3)}g\n\n` +
        `Gold has been added to Admin Stock.\n` +
        `Transaction completed for order "${order.orderName}".`
      )

      // Refresh the order data to reflect any changes
      await fetchOrder()

    } catch (collectError) {
      console.error('Error collecting order gold:', collectError)
      await error('Collection Failed', `Failed to collect gold: ${collectError instanceof Error ? collectError.message : 'Unknown error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'bg-blue-100 text-blue-800'
      case 'IN_PROCESS': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'DELIVERED': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'GOLD_IN':
      case 'GOLD_RECOVERY':
      case 'MANUFACTURING_COST':
        return 'text-green-600'
      case 'GOLD_OUT':
      case 'GOLD_LOSS':
        return 'text-red-600'
      default:
        return 'text-gray-600'
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

  const totalGoldLoss = order.processes.reduce((sum, p) => sum + (p.goldLoss || 0), 0)
  // const totalRecovered = order.transactions
  //   .filter(t => t.type === 'RECOVERY')
  //   .reduce((sum, t) => sum + t.recoveredGold, 0)

  // Helper function to get karat display name
  const getKaratDisplayName = (karat: number) => {
    switch (karat) {
      case 92: return '22k (92%)'
      case 75.5: return '18k (75.5%)'
      case 80: return '19.2k (80%)'
      case 59: return '14.2k (59%)'
      case 37.5: return '9k (37.5%)'
      default: return `${karat}% purity`
    }
  }

  return (
    <>
      {/* Print-only styles */}
      <style jsx>{`
        @media print {
          /* Hide everything except worksheet preview */
          .hide-on-print {
            display: none !important;
          }
          
          /* Show only worksheet preview */
          .print-only-worksheet {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            z-index: 9999;
            overflow: hidden;
          }
          
          /* Center and scale worksheet to fit page nicely */
          .print-worksheet-container {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            width: 100%;
            height: 100%;
            padding: 15mm;
            box-sizing: border-box;
          }
          
          /* Scale the worksheet appropriately for print */
          .print-worksheet-container > div {
            transform: scale(2.2) !important;
            transform-origin: top center !important;
            box-shadow: none !important;
          }
          
          /* Optimize page settings for worksheet */
          @page {
            margin: 5mm;
            size: A4 portrait;
          }
          
          /* Remove any background colors in print */
          * {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          
          /* Ensure borders are visible in print */
          .border, .border-black {
            border: 1px solid black !important;
          }
          
          /* Make sure yellow backgrounds show as light gray in print */
          .bg-yellow-200, .bg-yellow-300 {
            background: #f5f5f5 !important;
          }
          
          /* Make sure blue backgrounds show as light gray in print */
          .bg-blue-200 {
            background: #e5e5e5 !important;
          }
        }
        
        .print-only-worksheet {
          display: none;
        }
      `}</style>

      {/* Print-only worksheet preview */}
      <div className="print-only-worksheet">
        <div className="print-worksheet-container">
          <ManufacturingWorksheetPreview
            orderNumber={order.orderNumber || order.id}
            customerName={order.customer.name}
            orderName={order.orderName || ''}
            selectedKarat={order.selectedKarat || 92}
            size={order.size || ''}
            totalWeight={order.finalJewelryWeight.toString()}
            unit="grams"
            deliveryDate={order.deliveryDate}
            imageUrl={order.orderPhoto}
            adDetails={order.adDetails || []}
          />
        </div>
      </div>

      <div className="space-y-6 hide-on-print">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
              {order.orderNumber && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                  {order.orderNumber}
                </span>
              )}
            </div>
            <p className="text-gray-600">
              Customer: {order.customer.name}
              {order.orderName && (
                <span className="ml-2 text-blue-600 font-medium">• {order.orderName}</span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {(order.status === 'CREATED' || order.status === 'IN_PROCESS') && (
              <Link
                href={`/production-register?search=${order.orderNumber || order.id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                Edit in Register
              </Link>
            )}
            {(order.status === 'IN_PROCESS' && order.processes.length > 0) && (
              <Link
                href={`/orders/${orderId}/complete`}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                Complete Order
              </Link>
            )}
            {/* Delete Order Button */}
            <button
              onClick={handleDeleteOrder}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Delete Order
            </button>
            <Link
              href="/orders"
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium"
            >
              Back to Orders
            </Link>
          </div>
        </div>

        {/* Order Image Section */}
        {order.orderPhoto && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Order Reference Image</h2>
                <p className="text-gray-600 text-sm">Visual reference for manufacturing</p>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative max-w-md">
                <img
                  src={order.orderPhoto}
                  alt={`Order ${order.orderName || order.id}`}
                  className="w-full h-auto max-h-96 object-contain rounded-lg shadow-sm border border-gray-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = '<div class="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><p class="mt-2 text-sm text-gray-600">Image not available</p></div>';
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}





        {/* Transaction History */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Transaction History</h2>
          {order.transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {order.transactions
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
                      <p className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                        {['GOLD_IN', 'GOLD_RECOVERY', 'MANUFACTURING_COST'].includes(transaction.type) ? '+' : '-'}
                        {transaction.amount !== undefined && transaction.amount !== null ? transaction.amount.toFixed(3) : 'N/A'}g
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Manufacturing Worksheet Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Worksheet Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Manufacturing Worksheet</h2>
                  <p className="text-sm text-gray-600">Digital manufacturing worksheet for this order</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    onClick={async () => {
                      try {
                        await downloadManufacturingWorksheetExcel({
                          orderNumber: order.orderNumber || order.id,
                          customerName: order.customer.name,
                          orderName: order.orderName || '',
                          selectedKarat: order.selectedKarat || 92,
                          size: order.size || '',
                          totalWeight: order.finalJewelryWeight.toString(),
                          unit: 'grams',
                          deliveryDate: order.deliveryDate,
                          imageUrl: order.orderPhoto,
                          adDetails: order.adDetails || []
                        })
                      } catch (error) {
                        alert('Failed to export Excel worksheet. Please try again.')
                      }
                    }}
                  >
                    📊 Export to Excel
                  </button>
                  <button
                    type="button"
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    onClick={() => window.print()}
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">✓ Excel export includes order image embedded</p>
                <p className="text-sm text-gray-600 mb-2">✓ All order details and specifications</p>
                <p className="text-sm text-gray-600">✓ Ready for manufacturing workflow</p>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Worksheet Preview</h3>
              <div className="transform scale-50 origin-top-left">
                <ManufacturingWorksheetPreview
                  orderNumber={order.orderNumber || order.id}
                  customerName={order.customer.name}
                  orderName={order.orderName || ''}
                  selectedKarat={order.selectedKarat || 92}
                  size={order.size || ''}
                  totalWeight={order.finalJewelryWeight.toString()}
                  unit="grams"
                  deliveryDate={order.deliveryDate}
                  imageUrl={order.orderPhoto}
                />
              </div>
            </div>
          </div>
        </div>


        {/* Order Completion Summary - Show for completed orders only */}
        {order.status === 'COMPLETED' && (
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
                    <span className="font-medium">{(order.karigarStockAmount || 0).toFixed(3)}g</span>
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
                    <span className="font-medium text-blue-600">{(order.actualFinalWeight || 0).toFixed(3)}g</span>
                  </div>
                  {(order.totalStoneWeight || 0) > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Stone Weight:</span>
                        <span className="font-medium text-purple-600">{(order.totalStoneWeight || 0).toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Actual Gold Weight:</span>
                        <span className="font-semibold text-green-600">{(order.actualGoldWeight || 0).toFixed(3)}g</span>
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
                    <span className="font-medium text-green-600">{((order.actualGoldWeight || 0) * ((order.selectedKarat || 92) / 100)).toFixed(3)}g fine</span>
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
                        <div>In: {process.inputWeight !== undefined && process.inputWeight !== null ? process.inputWeight.toFixed(3) : 'N/A'}g</div>
                        <div>Out: {process.outputWeight !== undefined && process.outputWeight !== null ? process.outputWeight.toFixed(3) : 'Pending'}g</div>
                        <div className="text-red-600">Loss: {process.goldLoss !== undefined && process.goldLoss !== null ? process.goldLoss.toFixed(3) : 'TBD'}g</div>
                        <div className="text-blue-600 text-xs">{process.karigar.name}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bill Generation Section - Show for completed orders */}
        {order.status === 'COMPLETED' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">🧾 Create Customer Bill</h3>
              <p className="text-gray-600 mb-6">
                Order manufacturing is complete. You can now create a customer bill with making charges and stone options.
              </p>
              <Link
                href={`/orders/${orderId}/bill/unified`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md font-medium text-lg inline-block"
              >
                💰 Create Customer Bill
              </Link>
            </div>
          </div>
        )}

        {/* Complete Order Section */}
        {order.status === 'IN_PROCESS' && order.processes.some(p => p.outputWeight !== undefined && p.outputWeight > 0) && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Ready to Complete Order?</h3>
            <p className="text-yellow-700 mb-4">
              {order.processes.filter(p => p.outputWeight !== undefined && p.outputWeight > 0).length} manufacturing process(es) completed. You can finalize the order at any stage with gold recovery and final calculations.
            </p>
            <div className="mb-3">
              <p className="text-sm text-yellow-600">
                📋 Completed: {order.processes.filter(p => p.outputWeight !== undefined && p.outputWeight > 0).map(p => p.processType).join(', ')}
              </p>
            </div>
            <Link
              href={`/orders/${orderId}/complete`}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Complete Order
            </Link>
          </div>
        )}

        {/* Billed Order Status - Show for delivered orders */}
        {order.status === 'DELIVERED' && (
          <div className="bg-purple-50 border border-purple-200 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-purple-800">Order Completed & Billed</h3>
                  <p className="text-purple-700">
                    This order has been fully completed, billed, and delivered to the customer.
                  </p>
                  {billInfo && (
                    <p className="text-sm text-purple-600 mt-1">
                      📋 Bill Number: <span className="font-medium">{billInfo.billNumber}</span>
                    </p>
                  )}
                </div>
              </div>
              {billInfo && (
                <div className="flex space-x-2">
                  <Link
                    href={`/bills/${billInfo.id}`}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Bill
                  </Link>
                </div>
              )}
            </div>

            {/* Stock Status after billing */}
            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-3">📊 Post-Billing Stock Status</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Karigar Return Stock</p>
                  <p className="text-xl font-bold text-gray-400">Cleared</p>
                  <p className="text-xs text-gray-500">Transferred to billing</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded">
                  <p className="text-gray-600">Customer Stock Added</p>
                  <p className="text-xl font-bold text-orange-600">
                    {order.totalCustomerOwedFineGold !== undefined && order.totalCustomerOwedFineGold !== null ? order.totalCustomerOwedFineGold.toFixed(3) : 'N/A'}g
                  </p>
                  <p className="text-xs text-gray-500">Gold + Making charges</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded">
                  <p className="text-gray-600">Bill Status</p>
                  <p className="text-xl font-bold text-green-600">Created</p>
                  <p className="text-xs text-gray-500">Ready for collection</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default OrderDetailPage
