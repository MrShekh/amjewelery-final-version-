'use client'

import { useEffect, useState } from 'react'
import BillSuccessModal from './BillSuccessModal'

interface ItemDetail {
  description: string
  particulars: string
  rate: string
}

interface BillCalculation {
  completeOrderWeight: number
  kalesStoneWeight: number
  adWeight: number
  manufacturingCost: number
  removeKalesStone: boolean
  removeAdWeight: boolean
  advanceGoldUsed: number
  finalWeight: number
}

interface CustomerBillModalProps {
  onClose: () => void
  onBillCreated: () => void
  customerId: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  orderDetails?: {
    id: string
    orderName: string
    finalJewelryWeight: number
    actualFinalWeight?: number
    customerAdvanceGold?: number // Order advance gold
    customerProvidedGold?: boolean // Whether customer provided gold
  }
}

const CustomerBillModal: React.FC<CustomerBillModalProps> = ({ 
  onClose, 
  onBillCreated, 
  customerId, 
  customerName, 
  customerPhone,
  customerEmail,
  customerAddress,
  orderDetails 
}) => {
  const [loading, setLoading] = useState(false)
  const [nextBillNo, setNextBillNo] = useState('')
  const [billCreated, setBillCreated] = useState(false)
  const [createdBillData, setCreatedBillData] = useState<any>(null)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [availableAdvanceGold, setAvailableAdvanceGold] = useState(0)
  const [orderAdvanceGold, setOrderAdvanceGold] = useState(0)
  const [loadingAdvanceGold, setLoadingAdvanceGold] = useState(true)
  const [loadingOrderData, setLoadingOrderData] = useState(!!orderDetails?.id)
  // Use actual final weight if available for completed orders, otherwise use planned weight
  const effectiveFinalWeight = orderDetails?.actualFinalWeight || orderDetails?.finalJewelryWeight || 0
  
  const [calculation, setCalculation] = useState<BillCalculation>({
    completeOrderWeight: effectiveFinalWeight,
    kalesStoneWeight: 0,
    adWeight: 0,
    manufacturingCost: 0,
    removeKalesStone: false,
    removeAdWeight: false,
    advanceGoldUsed: 0,
    finalWeight: effectiveFinalWeight
  })

  const [formData, setFormData] = useState({
    billNo: '',
    itemDetails: [{ 
      description: orderDetails ? `${orderDetails.orderName} - Final Jewelry` : '',
      particulars: orderDetails ? 'Completed Order' : '',
      rate: orderDetails ? `${effectiveFinalWeight.toFixed(3)}g` : ''
    }] as ItemDetail[],
    termsAndConditions: 'All gold prices are subject to market rates. Customer gold remains customer property.',
    notes: orderDetails ? `Bill for Order: ${orderDetails.orderName} (#${orderDetails.id.slice(-8)})` : ''
  })

  useEffect(() => {
    generateBillNumber()
    fetchAvailableAdvanceGold()
    if (orderDetails?.id) {
      fetchOrderAdvanceGold(orderDetails.id)
    }
  }, [])

  useEffect(() => {
    calculateFinalWeight()
  }, [calculation.completeOrderWeight, calculation.kalesStoneWeight, calculation.adWeight, calculation.manufacturingCost, calculation.advanceGoldUsed, calculation.removeKalesStone, calculation.removeAdWeight])

  const generateBillNumber = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/bills/generate-bill-number', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setNextBillNo(data.billNumber)
        setFormData(prev => ({ ...prev, billNo: data.billNumber }))
      } else {
        setNextBillNo('Bill01')
        setFormData(prev => ({ ...prev, billNo: 'Bill01' }))
      }
    } catch (error) {
      console.error('Error generating bill number:', error)
      setNextBillNo('Bill01')
      setFormData(prev => ({ ...prev, billNo: 'Bill01' }))
    }
  }

  const fetchAvailableAdvanceGold = async () => {
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
  }

  const fetchOrderAdvanceGold = async (orderId: string) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/orders/${orderId}`, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const order = data.order
        
        if (order?.customerAdvanceGold && order.customerAdvanceGold > 0) {
          const advanceAmount = parseFloat(order.customerAdvanceGold)
          setOrderAdvanceGold(advanceAmount)
          
          // Auto-populate advance gold field with order's advance gold
          setCalculation(prev => ({
            ...prev,
            advanceGoldUsed: advanceAmount
          }))
          
          console.log(`Order ${orderId} has advance gold: ${advanceAmount}g - auto-populated`)
        }
      } else {
        console.error('Failed to fetch order details')
      }
    } catch (error) {
      console.error('Error fetching order advance gold:', error)
    } finally {
      setLoadingOrderData(false)
    }
  }

  const calculateFinalWeight = () => {
    let finalWeight = calculation.completeOrderWeight

    // Subtract weights if requested
    if (calculation.removeKalesStone) {
      finalWeight -= calculation.kalesStoneWeight
    }
    if (calculation.removeAdWeight) {
      finalWeight -= calculation.adWeight
    }

    // Add manufacturing cost
    finalWeight += calculation.manufacturingCost

    setCalculation(prev => ({ ...prev, finalWeight: Math.max(0, finalWeight) }))
  }

  const handleCalculationChange = (field: keyof BillCalculation, value: any) => {
    setCalculation(prev => ({
      ...prev,
      [field]: typeof value === 'number' ? Math.max(0, value) : value
    }))
  }

  const addItemDetail = () => {
    setFormData(prev => ({
      ...prev,
      itemDetails: [...prev.itemDetails, { description: '', particulars: '', rate: '' }]
    }))
  }

  const removeItemDetail = (index: number) => {
    if (formData.itemDetails.length > 1) {
      setFormData(prev => ({
        ...prev,
        itemDetails: prev.itemDetails.filter((_, i) => i !== index)
      }))
    }
  }

  const updateItemDetail = (index: number, field: keyof ItemDetail, value: string) => {
    setFormData(prev => ({
      ...prev,
      itemDetails: prev.itemDetails.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.billNo || calculation.completeOrderWeight <= 0) {
      alert('Please fill all required fields')
      return
    }

    const sessionToken = localStorage.getItem('sessionToken')
    if (!sessionToken) {
      alert('❌ Authentication required\n\nPlease log in again.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
          body: JSON.stringify({
            customerId: customerId,
            billNo: formData.billNo,
            completeOrderWeight: calculation.completeOrderWeight,
            kalesStoneWeight: calculation.kalesStoneWeight,
            adWeight: calculation.adWeight,
            manufacturingCost: calculation.manufacturingCost,
            removeKalesStone: calculation.removeKalesStone,
            removeAdWeight: calculation.removeAdWeight,
            advanceGoldUsed: calculation.advanceGoldUsed,
            itemDetails: formData.itemDetails,
            termsAndConditions: formData.termsAndConditions,
            notes: formData.notes,
            orderId: orderDetails?.id
          })
      })

      const data = await response.json()
      if (response.ok) {
        // Store bill data for PDF generation
        setCreatedBillData({
          billData: data.bill,
          calculation
        })
        setBillCreated(true)
        setShowPDFModal(true)
        onBillCreated()
      } else {
        console.error('API error response:', data)
        alert(`❌ Error creating bill: ${data.error || 'Unknown error'}\n\nStatus: ${response.status}\n\nPlease check your input and try again.`)
      }
    } catch (error) {
      console.error('Network/parsing error creating bill:', error)
      alert(`❌ Failed to create bill\n\nError: ${error instanceof Error ? error.message : 'Network error'}\n\nPlease check your connection and try again.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-4 mx-auto p-5 border max-w-5xl shadow-lg rounded-md bg-white">
          <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-medium text-gray-900">📋 Create Customer Bill</h3>
              <p className="text-sm text-gray-500 mt-1">
                Customer: <span className="font-medium">{customerName}</span>
                {orderDetails && <span> • Order: {orderDetails.orderName}</span>}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Bill Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bill Number *</label>
                  <input
                    type="text"
                    value={formData.billNo}
                    onChange={(e) => setFormData({ ...formData, billNo: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Bill01"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Next suggested: {nextBillNo}
                  </p>
                </div>
                {orderDetails && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Associated Order</label>
                    <input
                      type="text"
                      value={`${orderDetails.orderName} (#${orderDetails.id.slice(-8)})`}
                      disabled
                      className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Weight Calculation */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">⚖️ Weight Calculation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Complete Order Weight (g) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={calculation.completeOrderWeight}
                    onChange={(e) => handleCalculationChange('completeOrderWeight', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kales/Stone Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={calculation.kalesStoneWeight}
                    onChange={(e) => handleCalculationChange('kalesStoneWeight', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                  <label className="inline-flex items-center mt-1">
                    <input
                      type="checkbox"
                      checked={calculation.removeKalesStone}
                      onChange={(e) => handleCalculationChange('removeKalesStone', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-xs text-gray-600">Remove from final weight</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ad Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={calculation.adWeight}
                    onChange={(e) => handleCalculationChange('adWeight', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                  <label className="inline-flex items-center mt-1">
                    <input
                      type="checkbox"
                      checked={calculation.removeAdWeight}
                      onChange={(e) => handleCalculationChange('removeAdWeight', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-xs text-gray-600">Remove from final weight</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Manufacturing Cost (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={calculation.manufacturingCost}
                    onChange={(e) => handleCalculationChange('manufacturingCost', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Added to final weight</p>
                </div>
              </div>
              
              {/* Final Weight Display */}
              <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-800">Total Weight:</span>
                  <span className="text-lg font-bold text-green-900">{calculation.finalWeight.toFixed(3)} grams</span>
                </div>
                {calculation.advanceGoldUsed > 0 && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-purple-800">Advance Gold Applied:</span>
                    <span className="text-sm font-bold text-purple-900">-{calculation.advanceGoldUsed.toFixed(3)} grams</span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-200">
                  <span className="text-sm font-medium text-green-800">Remaining Balance:</span>
                  <span className="text-lg font-bold text-green-900">{(calculation.finalWeight - calculation.advanceGoldUsed).toFixed(3)} grams</span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  This remaining amount will be added to customer's gold balance
                </p>
              </div>
            </div>

            {/* Advance Gold Section */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">💎 Advance Gold Settlement</h4>
              
              {/* Show order advance gold info if available */}
              {orderAdvanceGold > 0 && (
                <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-green-800">🎯 Order Advance Gold Detected!</h5>
                      <p className="text-sm text-green-700">
                        This order has <strong>{orderAdvanceGold.toFixed(3)}g</strong> advance gold that will be automatically settled.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-green-900">{orderAdvanceGold.toFixed(3)}g</span>
                      <p className="text-xs text-green-600">From Order</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {orderAdvanceGold > 0 ? 'Total Advance Stock' : 'Available Advance Gold'}
                  </label>
                  <div className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600">
                    {loadingAdvanceGold ? 'Loading...' : `${availableAdvanceGold.toFixed(3)}g`}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {orderAdvanceGold > 0 ? 'Total in advance stock' : "Customer's advance gold stock"}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Advance Gold to Use (g)
                    {orderAdvanceGold > 0 && <span className="text-green-600"> - Auto-populated</span>}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={calculation.advanceGoldUsed}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      const maxAdvance = Math.min(availableAdvanceGold, calculation.finalWeight)
                      handleCalculationChange('advanceGoldUsed', Math.min(value, maxAdvance))
                    }}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 ${
                      orderAdvanceGold > 0 ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                    min="0"
                    max={Math.min(availableAdvanceGold, calculation.finalWeight)}
                    disabled={availableAdvanceGold === 0 || calculation.finalWeight === 0}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Max: {Math.min(availableAdvanceGold, calculation.finalWeight).toFixed(3)}g
                    {orderAdvanceGold > 0 && ` • Order has: ${orderAdvanceGold.toFixed(3)}g`}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer Pending Amount</label>
                  <div className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600">
                    <span className={`font-medium ${
                      (calculation.finalWeight - calculation.advanceGoldUsed) > 0 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {(calculation.finalWeight - calculation.advanceGoldUsed).toFixed(3)}g
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(calculation.finalWeight - calculation.advanceGoldUsed) > 0 
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
                      const maxAdvance = Math.min(availableAdvanceGold, calculation.finalWeight)
                      handleCalculationChange('advanceGoldUsed', maxAdvance)
                    }}
                    className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md mr-2"
                    disabled={calculation.finalWeight === 0}
                  >
                    Use Max Advance ({Math.min(availableAdvanceGold, calculation.finalWeight).toFixed(3)}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalculationChange('advanceGoldUsed', 0)}
                    className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                  >
                    Clear Advance
                  </button>
                </div>
              )}
              
              {availableAdvanceGold === 0 && !loadingAdvanceGold && !loadingOrderData && orderAdvanceGold === 0 && (
                <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ⚠️ No advance gold available for this customer.
                  </p>
                </div>
              )}
              
              {loadingOrderData && (
                <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-md">
                  <p className="text-sm text-blue-800">
                    🔄 Checking order for advance gold...
                  </p>
                </div>
              )}
              
              {calculation.advanceGoldUsed > 0 && (
                <div className="mt-4 p-3 bg-purple-100 border border-purple-300 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-purple-800">
                      Advance Gold Settlement:
                      {orderAdvanceGold > 0 && calculation.advanceGoldUsed === orderAdvanceGold && (
                        <span className="text-green-700"> ✓ From Order</span>
                      )}
                    </span>
                    <span className="text-lg font-bold text-purple-900">{calculation.advanceGoldUsed.toFixed(3)}g</span>
                  </div>
                  <p className="text-xs text-purple-700 mt-1">
                    This advance gold will be transferred from Advance Stock → Admin Stock
                  </p>
                  {(calculation.finalWeight - calculation.advanceGoldUsed) > 0 && (
                    <p className="text-xs text-orange-700 mt-1">
                      Pending: {(calculation.finalWeight - calculation.advanceGoldUsed).toFixed(3)}g will be added to Customer Stock
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Item Details */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900">📝 Item Details</h4>
                <button
                  type="button"
                  onClick={addItemDetail}
                  className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md"
                >
                  + Add Item
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.itemDetails.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border border-gray-200 rounded-md">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItemDetail(index, 'description', e.target.value)}
                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Item description"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Particulars</label>
                      <input
                        type="text"
                        value={item.particulars}
                        onChange={(e) => updateItemDetail(index, 'particulars', e.target.value)}
                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Item details"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700">Rate/Weight</label>
                        <input
                          type="text"
                          value={item.rate}
                          onChange={(e) => updateItemDetail(index, 'rate', e.target.value)}
                          className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Rate or weight"
                        />
                      </div>
                      {formData.itemDetails.length > 1 && (
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeItemDetail(index)}
                            className="px-2 py-1 text-red-600 hover:text-red-800 text-sm"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terms and Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Terms & Conditions</label>
                <textarea
                  rows={3}
                  value={formData.termsAndConditions}
                  onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter terms and conditions..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium disabled:opacity-50"
                disabled={loading || calculation.finalWeight <= 0}
              >
                {loading ? 'Creating...' : `Create Bill (${(calculation.finalWeight - calculation.advanceGoldUsed).toFixed(3)}g)`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    {/* Bill Success Modal with PDF Options */}
    {showPDFModal && createdBillData && (
      <BillSuccessModal
        isOpen={showPDFModal}
        onClose={() => {
          setShowPDFModal(false)
          onClose()
        }}
        billData={createdBillData.billData}
        customerName={customerName}
        customerPhone={customerPhone}
        customerEmail={customerEmail}
        customerAddress={customerAddress}
        finalWeight={createdBillData.calculation.finalWeight}
      />
    )}
    </>
  )
}

export default CustomerBillModal
