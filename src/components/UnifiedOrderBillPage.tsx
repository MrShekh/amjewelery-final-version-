'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BillPreview from './BillPreview'
import { generateBillPreviewHTML } from '@/utils/billPreviewGenerator'

interface Order {
  id: string
  orderName: string
  orderPhoto?: string
  orderNumber?: string
  status: string
  actualGoldWeight: number
  actualFinalWeight: number
  finalJewelryWeight: number
  totalStoneWeight: number
  selectedKarat: number
  customerProvidedGold: number
  customerAdvanceGold?: number
  customer: {
    id: string
    name: string
    phone: string
    email?: string
    address?: string
  }
  processes: Array<{
    id: string
    processType: string
    karigar: { name: string }
    inputWeight: number
    outputWeight: number
    goldLoss: number
  }>
}

interface UnifiedOrderBillPageProps {
  orderId: string
}

const UnifiedOrderBillPage: React.FC<UnifiedOrderBillPageProps> = ({ orderId }) => {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [availableAdvanceGold, setAvailableAdvanceGold] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [pastJamaAmount, setPastJamaAmount] = useState(0)
  const [pastJamaDetails, setPastJamaDetails] = useState<any[]>([])

  // Form data state
  const [billData, setBillData] = useState({
    netWeight: '0', // Added: manual entry for net gold weight
    manufacturingCostGrams: '0', // No longer used but kept for API compatibility
    makingCharge: '4', // NEW: Making charge dropdown value (3, 3.5, 4, etc.)
    baseWeight: 'pure_gold', // 'pure_gold' or 'with_stones'
    customStoneWeight: '0',
    customAdWeight: '0',
    advanceGoldUsed: '0',
    rupees: '0', // NEW: Rupees amount for bill
    manualMakingChargeGrams: '0', // NEW: Manual making charge in grams (for daily stock only)
    notes: ''
  })

  // Calculation state
  const [calculations, setCalculations] = useState({
    actualGoldWeight: 0,
    actualFinalWeight: 0,
    totalStoneWeight: 0,
    selectedKarat: 92,
    makingCharge: 0,
    karatPurity: 0.92,
    baseWeightSelected: 0, // The weight admin selects as base
    customStoneWeight: 0,
    customAdWeight: 0,
    totalCustomStoneWeight: 0,
    finalBillingWeight: 0, // Base + custom stones
    manufacturingCostGrams: 0,
    billingWeightInFineGold: 0,
    subtotalCustomerOwedFineGold: 0,
    advanceGoldUsed: 0,
    totalCustomerOwedFineGold: 0,
    rupees: 0 // NEW: Rupees amount
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

        // Auto-populate net weight and advance gold if available
        setBillData(prev => ({
          ...prev,
          netWeight: (orderData?.actualGoldWeight || 0).toString(),
          advanceGoldUsed: orderData?.customerAdvanceGold ? orderData.customerAdvanceGold.toString() : prev.advanceGoldUsed
        }))
      } else {
        const errorData = await response.json()
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

  const fetchInventory = useCallback(async () => {
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
      console.error('Error fetching inventory:', error)
    }
  }, [])

  const fetchPastJamaAmount = useCallback(async () => {
    if (!order?.customer?.id) return

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/customers/${order.customer.id}`, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (response.ok) {
        const data = await response.json()
        const customer = data.customer

        // Calculate past jama (excluding current order if it has jama balance already)
        let pastJama = 0
        let details: any[] = []
        if (customer.jamaGold?.balances) {
          const filteredBalances = customer.jamaGold.balances.filter((balance: any) => balance.orderId !== orderId)

          details = filteredBalances.map((balance: any) => ({
            orderId: balance.orderId || 'past',
            orderInfo: balance.order ? { orderName: balance.order.orderName } : (balance.notes ? { orderName: balance.notes } : undefined),
            pendingAmount: (balance.goldBalance || balance.jamaGoldAmount || 0) - (balance.returnedAmount || 0)
          })).filter((d: any) => d.pendingAmount > 0)

          pastJama = details.reduce((sum: number, d: any) => sum + d.pendingAmount, 0)
        }

        setPastJamaAmount(pastJama)
        setPastJamaDetails(details)
        console.log(`🔍 PAST JAMA FRONTEND: ${pastJama}g for customer ${customer.name}`);
      }
    } catch (error) {
      console.error('Error fetching customer past jama:', error)
      setPastJamaAmount(0)
      setPastJamaDetails([])
    }
  }, [order?.customer?.id, orderId])

  // Recalculate whenever form data changes
  useEffect(() => {
    if (!order) return

    const actualGoldWeight = parseFloat(billData.netWeight) || 0
    const totalStoneWeight = order.totalStoneWeight || 0
    const actualFinalWeight = actualGoldWeight + totalStoneWeight
    const selectedKarat = order.selectedKarat || 92
    const makingCharge = parseFloat(billData.makingCharge) || 0
    const karatPurity = (selectedKarat + makingCharge) / 100 // Add making charge to karat purity
    const manufacturingCostGrams = parseFloat(billData.manufacturingCostGrams) || 0
    const customStoneWeight = parseFloat(billData.customStoneWeight) || 0
    const customAdWeight = parseFloat(billData.customAdWeight) || 0
    const advanceGoldUsed = parseFloat(billData.advanceGoldUsed) || 0
    const rupees = parseFloat(billData.rupees) || 0

    // Calculate base weight based on admin selection
    let baseWeightSelected = 0
    if (billData.baseWeight === 'pure_gold') {
      baseWeightSelected = actualGoldWeight
    } else {
      baseWeightSelected = actualFinalWeight
    }

    // Add custom stone adjustments to base weight
    const totalCustomStoneWeight = customStoneWeight + customAdWeight
    const finalBillingWeight = baseWeightSelected + totalCustomStoneWeight

    // Convert to fine gold for final calculations
    const billingWeightInFineGold = finalBillingWeight * karatPurity
    const subtotalCustomerOwedFineGold = billingWeightInFineGold + manufacturingCostGrams
    const totalCustomerOwedFineGold = Math.max(0, subtotalCustomerOwedFineGold - advanceGoldUsed)

    setCalculations({
      actualGoldWeight,
      actualFinalWeight,
      totalStoneWeight,
      selectedKarat,
      makingCharge,
      karatPurity,
      baseWeightSelected,
      customStoneWeight,
      customAdWeight,
      totalCustomStoneWeight,
      finalBillingWeight,
      manufacturingCostGrams,
      billingWeightInFineGold,
      subtotalCustomerOwedFineGold,
      advanceGoldUsed,
      totalCustomerOwedFineGold,
      rupees
    })
  }, [order, billData])


  useEffect(() => {
    fetchOrder()
    fetchInventory()
  }, [fetchOrder, fetchInventory])

  // Fetch past jama amount when order is loaded
  useEffect(() => {
    if (order) {
      fetchPastJamaAmount()
    }
  }, [order, fetchPastJamaAmount])

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!order) return

    // Validate form
    if (calculations.manufacturingCostGrams < 0) {
      alert('Manufacturing cost cannot be negative')
      return
    }

    if (calculations.advanceGoldUsed > availableAdvanceGold) {
      alert(`Insufficient advance gold. Available: ${availableAdvanceGold.toFixed(3)}g`)
      return
    }

    setSubmitting(true)
    try {
      // Generate the bill preview HTML that matches exactly what user sees
      const previewHTML = generateBillPreviewHTML({
        order: order,
        calculations: {
          ...calculations,
          totalPastPendingAmount: pastJamaAmount
        },
        pastPendingDetails: pastJamaAmount > 0 ? pastJamaDetails : undefined,
        billNumber: 'PREVIEW' // Will be updated by backend with actual bill number
      })

      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/orders/${orderId}/bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          netWeight: calculations.actualGoldWeight, // Send manual netWeight!
          manufacturingCostGrams: 0, // No longer used - making charge is included in karat purity calculation
          makingCharge: parseFloat(billData.makingCharge) || 0, // NEW: Send making charge
          rupees: parseFloat(billData.rupees) || 0, // NEW: Send rupees amount
          manualMakingChargeGrams: parseFloat(billData.manualMakingChargeGrams) || 0, // NEW: Manual making charge in grams (for daily stock only)
          includeStones: billData.baseWeight === 'with_stones', // Convert baseWeight to includeStones boolean
          manualStoneWeight: calculations.customStoneWeight, // Backend expects manualStoneWeight
          manualAdWeight: calculations.customAdWeight, // Backend expects manualAdWeight  
          billingWeightOption: billData.baseWeight === 'pure_gold' ? 'PURE_GOLD_ONLY' : 'INCLUDE_STONE_WEIGHT', // Backend expects these string values
          advanceGoldUsed: calculations.advanceGoldUsed,
          notes: billData.notes,
          previewHTML: previewHTML // Save the generated preview HTML
        }),
      })

      if (response.ok) {
        const data = await response.json()

        console.log('🎉 Bill created successfully! API Response:', data)
        console.log('🆔 Bill ID:', data.bill?.id || data.bill?._id)

        // Show success message (guard against undefined values)
        const owedFineGold = (calculations.totalCustomerOwedFineGold || 0).toFixed(3)
        const successMessage = `✅ Bill created successfully!\n\nCustomer owes: ${owedFineGold}g fine gold\nCustomer stock increased by: ${owedFineGold}g`

        alert(successMessage)

        // Try different redirect options
        const billId = data.bill?.id || data.bill?._id
        if (billId) {
          console.log(`🔄 Redirecting to /bills/${billId}`)
          router.push(`/bills/${billId}`)
        } else {
          console.log('❌ No bill ID found, redirecting to bills list')
          router.push('/bills')
        }
      } else {
        const error = await response.json()
        alert(`❌ ${error.error || 'Failed to create bill'}`)
      }
    } catch (error) {
      console.error('Error creating bill:', error)
      alert('❌ Failed to create bill')
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
        <h2 className="text-2xl font-semibold text-gray-900">💰 Bill Already Created</h2>
        <p className="mt-2 text-gray-600">This order has already been billed and delivered.</p>
        <div className="mt-4 space-x-4">
          <Link href={`/orders/${orderId}`} className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
            View Order Details
          </Link>
          <Link href="/bills" className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg">
            View Bills
          </Link>
        </div>
      </div>
    )
  }

  if (order.status !== 'COMPLETED') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">⏳ Order Not Ready</h2>
        <p className="mt-2 text-gray-600">Order must be completed before creating a bill.</p>
        <p className="text-sm text-gray-500">Current status: <strong>{order.status}</strong></p>
        <div className="mt-4 space-x-4">
          <Link href={`/orders/${orderId}`} className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
            View Order Details
          </Link>
          {order.status !== 'COMPLETED' && order.status !== 'DELIVERED' && (
            <Link href={`/orders/${orderId}/complete`} className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg">
              Complete Order First
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">💰 Create Customer Bill</h1>
          <p className="text-gray-600">
            Customer: <span className="font-semibold text-blue-600">{order?.customer?.name || 'Loading...'}</span> •
            Order: <span className="font-semibold text-green-600">{order?.orderName || 'Loading...'}</span>
          </p>
        </div>
        <div className="space-x-2">
          <Link
            href={`/orders/${orderId}`}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium"
          >
            ← Back to Order
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Side - Form or Order Summary */}
        <div className="space-y-6">
          {/* Order Summary Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Order Summary</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">⚖️ Weights</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Final Weight:</span>
                    <span className="font-medium">{(order?.actualFinalWeight || 0).toFixed(3)}g</span>
                  </div>
                  {(order?.totalStoneWeight || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>Stone Weight:</span>
                      <span className="font-medium text-purple-600">{(order?.totalStoneWeight || 0).toFixed(3)}g</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-semibold">Gold Weight:</span>
                    <span className="font-semibold text-green-600">{(order?.actualGoldWeight || 0).toFixed(3)}g</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">🏭 Karat & Purity</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Karat Purity:</span>
                    <span className="font-medium">{order?.selectedKarat || 92}% ({(((order?.selectedKarat || 92) / 100) * 24).toFixed(1)}k)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fine Gold Weight:</span>
                    <span className="font-medium text-green-600">{(calculations.actualGoldWeight * calculations.karatPurity || 0).toFixed(3)}g</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Manufacturing Process Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">🔧 Manufacturing Process</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(order?.processes || []).map((process) => (
                  <div key={process.id} className="text-sm">
                    <div className="font-medium text-gray-900">{process.processType}</div>
                    <div className="text-gray-600">{(process.outputWeight || 0).toFixed(3)}g - {process.karigar?.name || 'Unknown'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">💰 Bill Configuration</h2>

            <form onSubmit={handleBillSubmit} className="space-y-6">
              {/* Making Charge Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Making Charge *
                </label>
                <select
                  required
                  value={billData.makingCharge}
                  onChange={(e) => setBillData({ ...billData, makingCharge: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                <p className="text-xs text-gray-500 mt-1">This making charge will be added to karat purity ({(order?.selectedKarat || 92)}% + {parseFloat(billData.makingCharge) || 0} = {((order?.selectedKarat || 92) + (parseFloat(billData.makingCharge) || 0)).toFixed(1)}%)</p>
              </div>


              {/* Flexible Weight Selection */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">⚖️ Select Base Weight for Billing</h4>
                <p className="text-sm text-gray-600 mb-4">Choose which weight you want to use as the base for billing, then adjust stones as needed:</p>

                {/* Net Weight Manual Input Field */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Net Weight (grams) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={billData.netWeight}
                    onChange={(e) => setBillData({ ...billData, netWeight: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-900"
                    placeholder="0.000"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    💡 Order gold weight is {(order?.actualGoldWeight || 0).toFixed(3)}g (Type to edit manually)
                  </p>
                </div>

                {/* Base Weight Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <label className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-blue-25 transition-colors ${billData.baseWeight === 'pure_gold'
                    ? 'border-blue-500 bg-blue-100'
                    : 'border-gray-300 bg-white'
                    }`}>
                    <input
                      type="radio"
                      name="baseWeight"
                      value="pure_gold"
                      checked={billData.baseWeight === 'pure_gold'}
                      onChange={(e) => setBillData({ ...billData, baseWeight: e.target.value })}
                      className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 flex items-center">
                        🥇 Pure Gold Weight
                        <span className="ml-2 text-lg font-bold text-green-600">
                          {(calculations.actualGoldWeight || 0).toFixed(3)}g
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Bill based on manually entered net gold weight
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-blue-25 transition-colors ${billData.baseWeight === 'with_stones'
                    ? 'border-blue-500 bg-blue-100'
                    : 'border-gray-300 bg-white'
                    }`}>
                    <input
                      type="radio"
                      name="baseWeight"
                      value="with_stones"
                      checked={billData.baseWeight === 'with_stones'}
                      onChange={(e) => setBillData({ ...billData, baseWeight: e.target.value })}
                      className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 flex items-center">
                        📎 Final Weight (with Stones)
                        <span className="ml-2 text-lg font-bold text-purple-600">
                          {(calculations.actualFinalWeight || 0).toFixed(3)}g
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Bill based on manually entered net weight + original stones
                      </div>
                      {order && (order.totalStoneWeight || 0) > 0 && (
                        <div className="text-xs text-purple-600 mt-1">
                          (Includes {(order.totalStoneWeight || 0).toFixed(3)}g stones)
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Custom Stone Weight Adjustments */}
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <h5 className="font-medium text-orange-900 mb-3">🎆 Additional Stone Weight Adjustments</h5>
                  <p className="text-sm text-gray-600 mb-3">Add or reduce stone weights to the selected base weight:</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Kales Stone Weight (g)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={billData.customStoneWeight}
                        onChange={(e) => setBillData({ ...billData, customStoneWeight: e.target.value })}
                        className="w-full px-3 py-2 border border-orange-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                        placeholder="0.000"
                      />
                      <div className="text-xs text-gray-500 mt-1">Can be positive (add) or negative (remove)</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom AD Weight (g)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={billData.customAdWeight}
                        onChange={(e) => setBillData({ ...billData, customAdWeight: e.target.value })}
                        className="w-full px-3 py-2 border border-orange-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                        placeholder="0.000"
                      />
                      <div className="text-xs text-gray-500 mt-1">Can be positive (add) or negative (remove)</div>
                    </div>
                  </div>
                </div>

                {/* Live Billing Weight Calculation */}
                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-300">
                  <h6 className="font-semibold text-green-900 mb-3">📈 Live Billing Calculation:</h6>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Base Weight Selected:</span>
                      <span className="font-bold text-blue-600">
                        {(calculations.baseWeightSelected || 0).toFixed(3)}g
                      </span>
                    </div>
                    {(calculations.totalCustomStoneWeight || 0) !== 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Stone Adjustments:</span>
                        <span className={`font-medium ${(calculations.totalCustomStoneWeight || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {(calculations.totalCustomStoneWeight || 0) >= 0 ? '+' : ''}{(calculations.totalCustomStoneWeight || 0).toFixed(3)}g
                        </span>
                      </div>
                    )}
                    <hr className="border-gray-300" />
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-800">Final Billing Weight:</span>
                      <span className="text-xl font-bold text-green-600">
                        {(calculations.finalBillingWeight || 0).toFixed(3)}g
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advance Gold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Advance Gold to Use (fine gold)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={availableAdvanceGold}
                  value={billData.advanceGoldUsed}
                  onChange={(e) => setBillData({ ...billData, advanceGoldUsed: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.000"
                />
                <p className="text-xs text-gray-500 mt-1">Available: {(availableAdvanceGold || 0).toFixed(3)}g</p>
                {order?.customerAdvanceGold && (
                  <p className="text-xs text-blue-600 mt-1">Customer advance: {(order.customerAdvanceGold || 0).toFixed(3)}g (auto-populated)</p>
                )}
              </div>

              {/* Rupees Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rupees Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={billData.rupees}
                  onChange={(e) => setBillData({ ...billData, rupees: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">Amount in rupees for the bill</p>
              </div>

              {/* Manual Making Charge (grams) - For daily stock only, not shown on PDF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manual Making Charge (g) <span className="text-xs text-gray-500">(for internal stock, not printed)</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={billData.manualMakingChargeGrams}
                  onChange={(e) => setBillData({ ...billData, manualMakingChargeGrams: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter manual making charge in grams. This will be used for daily "Manual Making Charge" stock on the dashboard only and will not appear on the customer bill or PDF.
                </p>
              </div>

              {/* Final Billing Summary with Making Charges */}
              <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                <h4 className="text-lg font-semibold text-indigo-900 mb-4">📊 Complete Billing Summary</h4>

                <div className="space-y-3">
                  {/* Weight Details */}
                  <div className="bg-white p-4 rounded border">
                    <h5 className="font-medium text-gray-900 mb-2">⚖️ Weight Breakdown:</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base Weight ({billData.baseWeight === 'pure_gold' ? 'Pure Gold' : 'With Stones'}):</span>
                        <span className="font-medium">{(calculations.baseWeightSelected || 0).toFixed(3)}g</span>
                      </div>
                      {(calculations.totalCustomStoneWeight || 0) !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Custom Stone Adjustments:</span>
                          <span className={`font-medium ${(calculations.totalCustomStoneWeight || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {(calculations.totalCustomStoneWeight || 0) >= 0 ? '+' : ''}{(calculations.totalCustomStoneWeight || 0).toFixed(3)}g
                          </span>
                        </div>
                      )}
                      <hr className="border-gray-300" />
                      <div className="flex justify-between font-semibold">
                        <span>Final Billing Weight:</span>
                        <span className="text-blue-600">{(calculations.finalBillingWeight || 0).toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>In Fine Gold ({((calculations.karatPurity || 0.92) * 100).toFixed(0)}% purity):</span>
                        <span>{(calculations.billingWeightInFineGold || 0).toFixed(3)}g fine</span>
                      </div>
                    </div>
                  </div>

                  {/* Charges and Payment */}
                  <div className="bg-white p-4 rounded border">
                    <h5 className="font-medium text-gray-900 mb-2">💰 Charges & Payment:</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Billing Weight (Fine Gold):</span>
                        <span className="font-medium">{(calculations.billingWeightInFineGold || 0).toFixed(3)}g</span>
                      </div>
                      {(calculations.manufacturingCostGrams || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Making Charges:</span>
                          <span className="font-medium text-green-600">+{(calculations.manufacturingCostGrams || 0).toFixed(3)}g fine</span>
                        </div>
                      )}
                      <hr className="border-gray-300" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">{(calculations.subtotalCustomerOwedFineGold || 0).toFixed(3)}g fine</span>
                      </div>
                      {(calculations.advanceGoldUsed || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Less: Advance Gold:</span>
                          <span className="font-medium text-red-600">-{(calculations.advanceGoldUsed || 0).toFixed(3)}g fine</span>
                        </div>
                      )}
                      <hr className="border-gray-300" />
                      <div className="flex justify-between font-bold text-lg">
                        <span className="text-gray-900">Customer Owes:</span>
                        <span className="text-orange-600">{(calculations.totalCustomerOwedFineGold || 0).toFixed(3)}g fine gold</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Notes (Optional)
                </label>
                <textarea
                  value={billData.notes}
                  onChange={(e) => setBillData({ ...billData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any additional notes for this bill..."
                />
              </div>

              {/* Submit Button */}
              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={submitting || (calculations.totalCustomerOwedFineGold || 0) <= 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-6 py-3 rounded-lg font-medium text-lg"
                >
                  {submitting ? 'Creating Bill...' : `💰 Create Bill (${(calculations.totalCustomerOwedFineGold || 0).toFixed(3)}g)`}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side - Professional Bill Preview (Always Visible) */}
        <div className="space-y-6">
          {/* Professional Bill Preview - Live Preview */}
          <div>
            {order ? (
              <BillPreview
                order={order}
                calculations={calculations}
                billData={{
                  ...billData,
                  pastPendingAmounts: pastJamaAmount > 0 ? {
                    totalAmount: pastJamaAmount,
                    details: pastJamaDetails
                  } : undefined
                }}
                billNumber="PREVIEW"
              />
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading order details...</p>
                </div>
              </div>
            )}

            {/* Create Bill Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleBillSubmit}
                disabled={!order || submitting || (calculations.totalCustomerOwedFineGold || 0) <= 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-8 py-4 rounded-lg font-medium text-lg shadow-lg"
              >
                {submitting ? 'Creating Bill...' : `💰 Create Bill (${(calculations.totalCustomerOwedFineGold || 0).toFixed(3)}g Fine Gold)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnifiedOrderBillPage
