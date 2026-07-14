'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatForBilling } from '@/utils/numberUtils'

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
  processes: Array<{
    id: string
    processType: string
    outputWeight: number
    karigar: {
      name: string
    }
  }>
}

interface OrderBillPageProps {
  orderId: string
}

const OrderBillPage: React.FC<OrderBillPageProps> = ({ orderId }) => {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [availableAdvanceGold, setAvailableAdvanceGold] = useState(0)
  const [orderAdvanceGold, setOrderAdvanceGold] = useState(0)
  const [loadingAdvanceGold, setLoadingAdvanceGold] = useState(true)
  const [billData, setBillData] = useState({
    manufacturingCostGrams: '0', // No longer used but kept for API compatibility
    makingCharge: '4', // NEW: Making charge dropdown value
    includeStones: true,
    manualStoneWeight: '0', // Will be initialized after order loads
    manualAdWeight: '0', // Will be initialized after order loads  
    advanceGoldUsed: '0',
    notes: '',
    billingWeightOption: 'PURE_GOLD_ONLY' // NEW: PURE_GOLD_ONLY or INCLUDE_STONE_WEIGHT
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
        
        // Check for order advance gold and auto-populate
        if (orderData?.customerAdvanceGold && orderData.customerAdvanceGold > 0) {
          const advanceAmount = parseFloat(orderData.customerAdvanceGold)
          setOrderAdvanceGold(advanceAmount)
          setBillData(prev => ({ ...prev, advanceGoldUsed: advanceAmount.toString() }))
          console.log(`Order has advance gold: ${advanceAmount}g - auto-populated`)
        }
        
        // Initialize stone weights with detected values (split equally)
        const detectedStoneWeight = orderData?.totalStoneWeight || 0
        if (detectedStoneWeight > 0) {
          const halfStoneWeight = formatForBilling(detectedStoneWeight / 2)
          setBillData(prev => ({
            ...prev,
            manualStoneWeight: halfStoneWeight,
            manualAdWeight: halfStoneWeight
          }))
          console.log(`Initialized stone weights: ${halfStoneWeight}g Kales + ${halfStoneWeight}g AD = ${formatForBilling(detectedStoneWeight)}g total`)
        }
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
      } else {
        setAvailableAdvanceGold(0)
      }
    } catch (error) {
      console.error('Error fetching advance gold:', error)
      setAvailableAdvanceGold(0)
    } finally {
      setLoadingAdvanceGold(false)
    }
  }, [])

  useEffect(() => {
    fetchOrder()
    fetchAvailableAdvanceGold()
  }, [fetchOrder, fetchAvailableAdvanceGold])

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setSubmitting(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/orders/${orderId}/bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          manufacturingCostGrams: 0, // No longer used - making charge is included in karat purity calculation
          makingCharge: parseFloat(billData.makingCharge) || 0, // NEW: Send making charge
          includeStones: billData.includeStones,
          manualStoneWeight: parseFloat(billData.manualStoneWeight) || 0,
          manualAdWeight: parseFloat(billData.manualAdWeight) || 0,
          advanceGoldUsed: parseFloat(billData.advanceGoldUsed) || 0,
          billingWeightOption: billData.billingWeightOption, // NEW: Include billing option
          notes: billData.notes
        }),
      })

      if (response.ok) {
        const data = await response.json()
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
        <h2 className="text-2xl font-semibold text-gray-900">Bill already created</h2>
        <p className="mt-2 text-gray-600">This order has already been billed and delivered.</p>
        <Link href={`/orders/${orderId}`} className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
          View Order Details
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

  const makingCharge = parseFloat(billData.makingCharge) || 0
  const karatPurity = (order.selectedKarat + makingCharge) / 100
  const manufacturingCostGrams = parseFloat(billData.manufacturingCostGrams) || 0
  const advanceGoldUsed = parseFloat(billData.advanceGoldUsed) || 0
  
  // Calculate manual stone weights
  const manualStoneWeight = parseFloat(billData.manualStoneWeight) || 0
  const manualAdWeight = parseFloat(billData.manualAdWeight) || 0
  const totalManualStoneWeight = manualStoneWeight + manualAdWeight
  
  // Calculate billing weight based on billing option
  let billingWeight
  let stockSourceExplanation
  
  if (billData.billingWeightOption === 'PURE_GOLD_ONLY') {
    // Option 1: Bill only pure gold weight (10.5g)
    billingWeight = order.actualGoldWeight
    stockSourceExplanation = `Stock source: ${formatForBilling(billingWeight * karatPurity)}g will be deducted from Karigar Return Stock`
  } else {
    // Option 2: Bill with stone weight (11g) but admin adds stone cost separately
    billingWeight = order.actualGoldWeight + totalManualStoneWeight
    stockSourceExplanation = `Stock source: ${formatForBilling(order.actualGoldWeight * karatPurity)}g from Karigar Return Stock + ${formatForBilling(totalManualStoneWeight)}g stone weight (admin provides stones)`
  }
  
  // Convert entire billing weight to fine gold
  const billingWeightInFineGold = billingWeight * karatPurity
  
  // Total customer owes = billing weight in fine gold + manufacturing cost - advance gold used
  const totalCustomerOwedFineGold = Math.max(0, billingWeightInFineGold + manufacturingCostGrams - advanceGoldUsed)
  
  // For display: actual gold weight in fine gold
  const actualGoldWeightInFineGold = order.actualGoldWeight * karatPurity

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Customer Bill</h1>
          <p className="text-gray-600">Customer: {order.customer.name} • Order: {order.orderName}</p>
        </div>
        <Link
          href={`/orders/${orderId}/complete`}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium"
        >
          Back to Completion
        </Link>
      </div>

      {/* Order Summary */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Order Summary</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">⚖️ Weights</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Final Weight:</span>
                <span className="font-medium">{formatForBilling(order.actualFinalWeight)}g</span>
              </div>
              {order.totalStoneWeight > 0 && (
                <div className="flex justify-between">
                  <span>Stone Weight:</span>
                  <span className="font-medium text-purple-600">{formatForBilling(order.totalStoneWeight)}g</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Actual Gold Weight:</span>
                <span className="font-semibold text-green-600">{formatForBilling(order.actualGoldWeight)}g</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">🏭 Karat & Purity</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Karat Purity:</span>
                <span className="font-medium">{order.selectedKarat}% ({formatForBilling(order.selectedKarat/100*24)}k)</span>
              </div>
              <div className="flex justify-between">
                <span>Actual Gold (Fine):</span>
                <span className="font-medium text-green-600">{formatForBilling(order.actualGoldWeight * karatPurity)}g</span>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-orange-900 mb-2">📦 Stock Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Karigar Return Stock:</span>
                <span className="font-medium text-orange-600">{formatForBilling(order.actualGoldWeight * karatPurity)}g fine</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-medium text-green-600">Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Manufacturing Process Summary */}
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">🔧 Manufacturing Process</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {order.processes.sort((a, b) => a.processType.localeCompare(b.processType)).map((process) => (
              <div key={process.id} className="text-sm">
                <div className="font-medium text-gray-900">{process.processType}</div>
                <div className="text-gray-600">{formatForBilling(process.outputWeight)}g - {process.karigar.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bill Creation Form */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Billing Configuration</h2>
        
        <form onSubmit={handleBillSubmit} className="space-y-6">
          {/* NEW: Billing Weight Option */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">💎 Billing Weight Option</h3>
            <p className="text-sm text-gray-600 mb-4">Choose how to calculate the final billing weight:</p>
            
            <div className="space-y-4">
              <label className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="billingWeightOption"
                  value="PURE_GOLD_ONLY"
                  checked={billData.billingWeightOption === 'PURE_GOLD_ONLY'}
                  onChange={(e) => setBillData({ ...billData, billingWeightOption: e.target.value })}
                  className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">🥇 Pure Gold Only (Recommended)</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Bill customer for pure gold weight only: <strong>{formatForBilling(order.actualGoldWeight)}g</strong><br/>
                    <span className="text-green-600">✓ Stock balanced: Karigar returned {formatForBilling(order.actualGoldWeight)}g, customer billed {formatForBilling(order.actualGoldWeight)}g</span>
                  </div>
                </div>
              </label>
              
              <label className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="billingWeightOption"
                  value="INCLUDE_STONE_WEIGHT"
                  checked={billData.billingWeightOption === 'INCLUDE_STONE_WEIGHT'}
                  onChange={(e) => setBillData({ ...billData, billingWeightOption: e.target.value })}
                  className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">💎 Include Stone Weight</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Bill customer including stone weight: <strong>{formatForBilling(order.actualGoldWeight + totalManualStoneWeight)}g</strong><br/>
                    <span className="text-orange-600">⚠️ Admin must provide {formatForBilling(totalManualStoneWeight)}g worth of stones from inventory</span>
                  </div>
                </div>
              </label>
            </div>
            
            {/* Stock Impact Warning */}
            <div className={`mt-4 p-3 rounded-lg border ${
              billData.billingWeightOption === 'PURE_GOLD_ONLY' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="text-sm font-medium mb-1">
                📊 Stock Impact:
              </div>
              <div className="text-sm">
                {stockSourceExplanation}
              </div>
            </div>
          </div>
          {/* Making Charge Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Making Charge *
            </label>
            <select
              required
              value={billData.makingCharge}
              onChange={(e) => setBillData({ ...billData, makingCharge: e.target.value })}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1">1</option>
              <option value="1.5">1.5</option>
              <option value="2">2</option>
              <option value="2.5">2.5</option>
              <option value="3">3</option>
              <option value="3.5">3.5</option>
              <option value="4">4</option>
              <option value="4.5">4.5</option>
              <option value="5">5</option>
              <option value="5.5">5.5</option>
              <option value="6">6</option>
              <option value="6.5">6.5</option>
              <option value="7">7</option>
              <option value="7.5">7.5</option>
              <option value="8">8</option>
              <option value="8.5">8.5</option>
              <option value="9">9</option>
              <option value="9.5">9.5</option>
              <option value="10">10</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Making charge added to karat purity ({order.selectedKarat}% + {makingCharge} = {(order.selectedKarat + makingCharge).toFixed(1)}%)
            </p>
          </div>
          

          {/* Advance Gold Settlement Section */}
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h4 className="font-medium text-purple-900 mb-3">💎 Advance Gold Settlement</h4>
            
            {/* Show order advance gold info if available */}
            {orderAdvanceGold > 0 && (
              <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium text-green-800">🎯 Order Advance Gold Detected!</h5>
                    <p className="text-sm text-green-700">
                      This order has <strong>{formatForBilling(orderAdvanceGold)}g</strong> advance gold that will be automatically settled.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-green-900">{formatForBilling(orderAdvanceGold)}g</span>
                    <p className="text-xs text-green-600">From Order</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-1">
                  {orderAdvanceGold > 0 ? 'Total Advance Stock' : 'Available Advance Gold'}
                </label>
                <div className="px-3 py-2 border border-purple-200 rounded-md bg-purple-50 text-purple-700">
                  {loadingAdvanceGold ? 'Loading...' : `${formatForBilling(availableAdvanceGold)}g`}
                </div>
                <p className="text-xs text-purple-600 mt-1">
                  {orderAdvanceGold > 0 ? 'Total in advance stock' : "Customer's advance gold stock"}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-1">
                  Advance Gold to Use (g)
                  {orderAdvanceGold > 0 && <span className="text-green-600"> - Auto-populated</span>}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={billData.advanceGoldUsed}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    const maxAdvance = Math.min(availableAdvanceGold, billingWeightInFineGold + manufacturingCostGrams)
                    setBillData({ ...billData, advanceGoldUsed: Math.min(value, maxAdvance).toString() })
                  }}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 ${
                    orderAdvanceGold > 0 ? 'border-green-300 bg-green-50' : 'border-purple-300'
                  }`}
                  max={Math.min(availableAdvanceGold, billingWeightInFineGold + manufacturingCostGrams)}
                  disabled={availableAdvanceGold === 0 || (billingWeightInFineGold + manufacturingCostGrams) === 0}
                />
                <p className="text-xs text-purple-600 mt-1">
                  Max: {formatForBilling(Math.min(availableAdvanceGold, billingWeightInFineGold + manufacturingCostGrams))}g
                  {orderAdvanceGold > 0 && ` • Order has: ${formatForBilling(orderAdvanceGold)}g`}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-1">Customer Pending Amount</label>
                <div className="px-3 py-2 border border-purple-200 rounded-md bg-purple-50">
                  <span className={`font-medium ${
                    totalCustomerOwedFineGold > 0 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {formatForBilling(totalCustomerOwedFineGold)}g
                  </span>
                </div>
                <p className="text-xs text-purple-600 mt-1">
                  {totalCustomerOwedFineGold > 0 
                    ? 'Customer still owes (will add to customer stock)' 
                    : 'Fully settled by advance gold'
                  }
                </p>
              </div>
            </div>
            
            {availableAdvanceGold > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const maxAdvance = Math.min(availableAdvanceGold, billingWeightInFineGold + manufacturingCostGrams)
                    setBillData({ ...billData, advanceGoldUsed: maxAdvance.toString() })
                  }}
                  className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md mr-2"
                  disabled={(billingWeightInFineGold + manufacturingCostGrams) === 0}
                >
                  Use Max Advance ({formatForBilling(Math.min(availableAdvanceGold, billingWeightInFineGold + manufacturingCostGrams))}g)
                </button>
                <button
                  type="button"
                  onClick={() => setBillData({ ...billData, advanceGoldUsed: '0' })}
                  className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                >
                  Clear Advance
                </button>
              </div>
            )}
            
            {availableAdvanceGold === 0 && !loadingAdvanceGold && orderAdvanceGold === 0 && (
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ No advance gold available for this customer.
                </p>
              </div>
            )}
            
            {advanceGoldUsed > 0 && (
              <div className="mt-4 p-3 bg-purple-100 border border-purple-300 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-800">
                    Advance Gold Settlement:
                    {orderAdvanceGold > 0 && advanceGoldUsed === orderAdvanceGold && (
                      <span className="text-green-700"> ✓ From Order</span>
                    )}
                  </span>
                  <span className="text-lg font-bold text-purple-900">{formatForBilling(advanceGoldUsed)}g</span>
                </div>
                <p className="text-xs text-purple-700 mt-1">
                  This advance gold will be transferred from Advance Stock → Admin Stock
                </p>
                {totalCustomerOwedFineGold > 0 && (
                  <p className="text-xs text-orange-700 mt-1">
                    Pending: {formatForBilling(totalCustomerOwedFineGold)}g will be added to Customer Stock
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Admin Stone Weight Control */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">💎 Admin Stone Weight Control</h3>
            <p className="text-sm text-gray-600 mb-4">Adjust AD and Kales stone weights. Changes automatically update fine gold calculations.</p>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1">
                    Current Total Weight
                  </label>
                  <div className="px-3 py-2 bg-white border border-green-300 rounded-md text-sm font-medium">
                    {formatForBilling(order.actualFinalWeight)}g
                  </div>
                  <p className="text-xs text-green-600 mt-1">From manufacturing</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1">
                    Detected Stone Weight
                  </label>
                  <div className="px-3 py-2 bg-white border border-green-300 rounded-md text-sm font-medium">
                    {formatForBilling(order.totalStoneWeight)}g
                  </div>
                  <p className="text-xs text-green-600 mt-1">Auto-detected: {(order.totalStoneWeight * 1000).toFixed(0)}mg</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1">
                    Current Gold Weight
                  </label>
                  <div className="px-3 py-2 bg-white border border-green-300 rounded-md text-sm font-medium">
                    {formatForBilling(order.actualGoldWeight)}g
                  </div>
                  <p className="text-xs text-green-600 mt-1">Pure gold returned by karigar</p>
                </div>
              </div>
            </div>
            
            {/* Admin Stone Weight Adjustment */}
            <div className="bg-white p-4 rounded-lg border border-gray-300">
              <h4 className="font-medium text-gray-900 mb-3">🔧 Admin Adjustments</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kales Stone Weight (grams) 💎
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={billData.manualStoneWeight}
                    onChange={(e) => setBillData({ ...billData, manualStoneWeight: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`${formatForBilling(order.totalStoneWeight / 2)}`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Detected: {(order.totalStoneWeight / 2 * 1000).toFixed(0)}mg | Current: {(parseFloat(billData.manualStoneWeight) * 1000 || 0).toFixed(0)}mg
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AD Weight (grams) ⚙️
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={billData.manualAdWeight}
                    onChange={(e) => setBillData({ ...billData, manualAdWeight: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`${formatForBilling(order.totalStoneWeight / 2)}`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Detected: {(order.totalStoneWeight / 2 * 1000).toFixed(0)}mg | Current: {(parseFloat(billData.manualAdWeight) * 1000 || 0).toFixed(0)}mg
                  </p>
                </div>
              </div>
              
              {/* Quick Preset Buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBillData({ 
                    ...billData, 
                    manualStoneWeight: formatForBilling(order.totalStoneWeight / 2),
                    manualAdWeight: formatForBilling(order.totalStoneWeight / 2)
                  })}
                  className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-md hover:bg-blue-200"
                >
                  📋 Use Detected ({(order.totalStoneWeight * 1000).toFixed(0)}mg total)
                </button>
                <button
                  type="button"
                  onClick={() => setBillData({ 
                    ...billData, 
                    manualStoneWeight: '0.250',
                    manualAdWeight: '0.250'
                  })}
                  className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-md hover:bg-green-200"
                >
                  ⚡ Standard 500mg (250+250)
                </button>
                <button
                  type="button"
                  onClick={() => setBillData({ 
                    ...billData, 
                    manualStoneWeight: '0',
                    manualAdWeight: '0'
                  })}
                  className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-md hover:bg-red-200"
                >
                  🚫 No Stones (0mg)
                </button>
              </div>
              
              {/* Stone Weight Impact */}
              <div className={`mt-3 p-3 rounded-md border ${
                totalManualStoneWeight > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="text-sm font-medium mb-1">
                  📊 Stone Weight Impact:
                </div>
                <div className="text-sm space-y-1">
                  <div>Total Stone Weight: <strong>{formatForBilling(totalManualStoneWeight)}g ({(totalManualStoneWeight * 1000).toFixed(0)}mg)</strong></div>
                  
                  {billData.billingWeightOption === 'PURE_GOLD_ONLY' ? (
                    <div className="text-green-600">✓ Billing pure gold only - stone weight excluded from customer bill</div>
                  ) : (
                    <div className="text-orange-600">⚠️ Stone weight included in customer billing - admin must provide stones</div>
                  )}
                  
                  {totalManualStoneWeight !== order.totalStoneWeight && (
                    <div className={`${totalManualStoneWeight > order.totalStoneWeight ? 'text-red-600' : 'text-blue-600'}`}>
                      {totalManualStoneWeight > order.totalStoneWeight ? '↗️' : '↙️'} 
                      {totalManualStoneWeight > order.totalStoneWeight ? 'Increased' : 'Decreased'} by {formatForBilling(Math.abs(totalManualStoneWeight - order.totalStoneWeight))}g
                      ({Math.abs((totalManualStoneWeight - order.totalStoneWeight) * 1000).toFixed(0)}mg)
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {order.totalStoneWeight > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Original detected stone weight: {formatForBilling(order.totalStoneWeight)}g (reference only)
              </p>
            )}
          </div>

          {/* Bill Preview */}
          <div className="bg-gray-50 p-6 rounded-lg border">
            <h3 className="text-xl font-bold text-gray-900 mb-4">📄 Customer Bill Preview</h3>
            
            <div className="space-y-4">
              {/* Weight Calculation */}
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-semibold text-gray-900 mb-3">Weight Calculation:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Actual Gold Weight ({order.selectedKarat}%):</span>
                    <span className="font-medium text-green-600">{formatForBilling(order.actualGoldWeight)}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual Gold Weight (Fine Gold):</span>
                    <span className="font-medium text-green-600">{formatForBilling(order.actualGoldWeight * karatPurity)}g</span>
                  </div>
                  {billData.includeStones && totalManualStoneWeight > 0 && (
                    <>
                      {manualStoneWeight > 0 && (
                        <div className="flex justify-between">
                          <span>Manual Stone Weight:</span>
                          <span className="font-medium text-purple-600">{formatForBilling(manualStoneWeight)}g</span>
                        </div>
                      )}
                      {manualAdWeight > 0 && (
                        <div className="flex justify-between">
                          <span>Manual Ad/Other Weight:</span>
                          <span className="font-medium text-purple-600">{formatForBilling(manualAdWeight)}g</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Total Added Weight:</span>
                        <span className="font-medium text-purple-600">{formatForBilling(totalManualStoneWeight)}g</span>
                      </div>
                    </>
                  )}
                  {manufacturingCostGrams > 0 && (
                    <div className="flex justify-between">
                      <span>Manufacturing Cost (Fine Gold):</span>
                      <span className="font-medium text-orange-600">{formatForBilling(manufacturingCostGrams)}g</span>
                    </div>
                  )}
                  <hr />
                  <div className="flex justify-between font-bold">
                    <span>Subtotal (Billing + Manufacturing):</span>
                    <span className="text-blue-600">{formatForBilling(billingWeightInFineGold + manufacturingCostGrams)}g</span>
                  </div>
                  {advanceGoldUsed > 0 && (
                    <div className="flex justify-between">
                      <span>Less: Advance Gold Applied:</span>
                      <span className="font-medium text-purple-600">-{formatForBilling(advanceGoldUsed)}g</span>
                    </div>
                  )}
                  <hr />
                  <div className="flex justify-between font-bold">
                    <span>Final Customer Owes (Fine Gold):</span>
                    <span className={`${totalCustomerOwedFineGold > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatForBilling(totalCustomerOwedFineGold)}g</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className={`p-4 rounded-lg border-2 ${
                totalCustomerOwedFineGold > 0 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <h4 className={`font-bold mb-3 ${
                  totalCustomerOwedFineGold > 0 ? 'text-blue-900' : 'text-green-900'
                }`}>💰 Final Bill Summary:</h4>
                <div className="space-y-1">
                  <div className={`text-lg font-bold ${
                    totalCustomerOwedFineGold > 0 ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {totalCustomerOwedFineGold > 0 
                      ? `🥇 Customer owes: ${formatForBilling(totalCustomerOwedFineGold)}g fine gold`
                      : `✅ Fully settled by advance gold!`
                    }
                  </div>
                  <div className={`text-sm ${
                    totalCustomerOwedFineGold > 0 ? 'text-blue-700' : 'text-green-700'
                  }`}>
                    Billing weight: {formatForBilling(billingWeight)}g ({billData.billingWeightOption === 'PURE_GOLD_ONLY' ? 'pure gold only' : 'gold + stones'})
                    {advanceGoldUsed > 0 && ` • Advance applied: ${formatForBilling(advanceGoldUsed)}g`}
                    {billData.billingWeightOption === 'INCLUDE_STONE_WEIGHT' && totalManualStoneWeight > 0 && 
                      ` • Admin provides ${formatForBilling(totalManualStoneWeight)}g stones`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={billData.notes}
              onChange={(e) => setBillData({ ...billData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes for this bill..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Link
              href={`/orders/${orderId}/complete`}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-md font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-8 py-3 rounded-md font-medium text-lg"
            >
              {submitting ? 'Creating Bill...' : `✅ Create Bill (${formatForBilling(totalCustomerOwedFineGold)}g fine)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default OrderBillPage
