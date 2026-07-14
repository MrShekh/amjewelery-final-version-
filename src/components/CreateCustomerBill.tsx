'use client'

import { useEffect, useState } from 'react'

interface Customer {
  id: string
  name: string
  phone: string
  address?: string
}

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
  finalWeight: number
  billingWeightOption: boolean // NEW: true = include stones, false = pure gold only
  advanceGoldUsed: number // NEW: Advance gold
}

const CreateCustomerBill = ({ onClose, onBillCreated }: { onClose: () => void, onBillCreated: () => void }) => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [calculation, setCalculation] = useState<BillCalculation>({
    completeOrderWeight: 0,
    kalesStoneWeight: 0,
    adWeight: 0,
    manufacturingCost: 0,
    removeKalesStone: false,
    removeAdWeight: false,
    finalWeight: 0,
    billingWeightOption: false, // NEW: Default to pure gold only (false)
    advanceGoldUsed: 0 // NEW: No advance gold by default
  })

  const [formData, setFormData] = useState({
    customerId: '',
    billNo: '',
    itemDetails: [{ description: '', particulars: '', rate: '' }] as ItemDetail[],
    termsAndConditions: '',
    notes: ''
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    calculateFinalWeight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculation.completeOrderWeight, calculation.kalesStoneWeight, calculation.adWeight, calculation.manufacturingCost, calculation.removeKalesStone, calculation.removeAdWeight, calculation.billingWeightOption, calculation.advanceGoldUsed])

  const fetchCustomers = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/customers?mode=dropdown', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const calculateFinalWeight = () => {
    let finalWeight = calculation.completeOrderWeight

    // Apply legacy stone removal first (for backward compatibility)
    if (calculation.removeKalesStone) {
      finalWeight -= calculation.kalesStoneWeight
    }
    if (calculation.removeAdWeight) {
      finalWeight -= calculation.adWeight
    }

    // Add manufacturing cost
    finalWeight += calculation.manufacturingCost

    // NEW: Handle billing weight options
    if (calculation.billingWeightOption) {
      // Include stone weights in billing - add back the stone weights that weren't removed
      if (!calculation.removeKalesStone) {
        finalWeight += calculation.kalesStoneWeight
      }
      if (!calculation.removeAdWeight) {
        finalWeight += calculation.adWeight
      }
    }
    // If billingWeightOption is false (pure gold only), stones are already handled by remove checkboxes

    setCalculation(prev => ({ ...prev, finalWeight: Math.max(0, finalWeight) }))
  }

  const handleCalculationChange = (field: keyof BillCalculation, value: number | boolean) => {
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

    if (!formData.customerId || !formData.billNo || calculation.completeOrderWeight <= 0) {
      alert('Please fill all required fields')
      return
    }

    setLoading(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          customerId: formData.customerId,
          billNo: formData.billNo,
          completeOrderWeight: calculation.completeOrderWeight,
          kalesStoneWeight: calculation.kalesStoneWeight,
          adWeight: calculation.adWeight,
          manufacturingCost: calculation.manufacturingCost,
          removeKalesStone: calculation.removeKalesStone,
          removeAdWeight: calculation.removeAdWeight,
          billingWeightOption: calculation.billingWeightOption, // NEW: Include billing option
          advanceGoldUsed: calculation.advanceGoldUsed, // NEW: Include advance gold
          itemDetails: formData.itemDetails,
          termsAndConditions: formData.termsAndConditions,
          notes: formData.notes
        })
      })

      const data = await response.json()
      if (response.ok) {
        alert(`Bill created successfully! Customer stock increased by ${calculation.finalWeight.toFixed(3)}g`)
        onBillCreated()
        onClose()
      } else {
        alert(data.error || 'Failed to create bill')
      }
    } catch (error) {
      console.error('Error creating bill:', error)
      alert('Failed to create bill')
    } finally {
      setLoading(false)
    }
  }

  const selectedCustomer = customers.find(c => c.id === formData.customerId)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-medium text-gray-900">📋 Create Customer Bill</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Customer *</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Bill No *</label>
                <input
                  type="text"
                  value={formData.billNo}
                  onChange={(e) => setFormData({ ...formData, billNo: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter bill number"
                  required
                />
              </div>
            </div>

            {/* Weight Calculations */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-lg font-medium text-blue-900 mb-3">⚖️ Weight Calculations</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Complete Order Weight (grams) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={calculation.completeOrderWeight}
                    onChange={(e) => handleCalculationChange('completeOrderWeight', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 10.000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Manufacturing Cost (grams)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={calculation.manufacturingCost}
                    onChange={(e) => handleCalculationChange('manufacturingCost', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 0.500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Kales Stone Weight (grams)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={calculation.kalesStoneWeight}
                    onChange={(e) => handleCalculationChange('kalesStoneWeight', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 0.500"
                  />
                  <div className="mt-1">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={calculation.removeKalesStone}
                        onChange={(e) => handleCalculationChange('removeKalesStone', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600">Remove from final weight</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Ad Weight (grams)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={calculation.adWeight}
                    onChange={(e) => handleCalculationChange('adWeight', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 0.200"
                  />
                  <div className="mt-1">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={calculation.removeAdWeight}
                        onChange={(e) => handleCalculationChange('removeAdWeight', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600">Remove from final weight</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Calculation Summary */}
              <div className="mt-4 p-3 bg-white rounded border">
                <h5 className="font-medium text-gray-900 mb-2">📊 Weight Calculation Steps:</h5>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Complete Order Weight:</span>
                    <span className="font-medium">+{calculation.completeOrderWeight.toFixed(3)}g</span>
                  </div>
                  {calculation.removeKalesStone && calculation.kalesStoneWeight > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Kales Stone Weight (removed):</span>
                      <span className="font-medium">-{calculation.kalesStoneWeight.toFixed(3)}g</span>
                    </div>
                  )}
                  {calculation.removeAdWeight && calculation.adWeight > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Ad Weight (removed):</span>
                      <span className="font-medium">-{calculation.adWeight.toFixed(3)}g</span>
                    </div>
                  )}
                  {calculation.manufacturingCost > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Manufacturing Cost (added):</span>
                      <span className="font-medium">+{calculation.manufacturingCost.toFixed(3)}g</span>
                    </div>
                  )}
                  {calculation.billingWeightOption && (
                    <div className="space-y-1">
                      {!calculation.removeKalesStone && calculation.kalesStoneWeight > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span>Kales Stone Weight (included):</span>
                          <span className="font-medium">+{calculation.kalesStoneWeight.toFixed(3)}g</span>
                        </div>
                      )}
                      {!calculation.removeAdWeight && calculation.adWeight > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span>Ad Weight (included):</span>
                          <span className="font-medium">+{calculation.adWeight.toFixed(3)}g</span>
                        </div>
                      )}
                    </div>
                  )}
                  <hr className="my-2" />
                  <div className="flex justify-between text-lg font-bold text-blue-600">
                    <span>Total Billing Weight:</span>
                    <span>{calculation.finalWeight.toFixed(3)}g</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Options */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="text-lg font-medium text-yellow-900 mb-3">💰 Billing Options</h4>

              <div className="space-y-4">
                {/* Billing Weight Option */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Billing Weight Method</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="billingWeightOption"
                        checked={!calculation.billingWeightOption}
                        onChange={() => handleCalculationChange('billingWeightOption', false)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">
                        🔹 <strong>Pure Gold Only</strong> - Bill customer for actual gold weight (excludes stones)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="billingWeightOption"
                        checked={calculation.billingWeightOption}
                        onChange={() => handleCalculationChange('billingWeightOption', true)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">
                        🔸 <strong>Include Stone Weight</strong> - Bill customer for total weight (includes stones)
                      </span>
                    </label>
                  </div>
                  <div className="mt-2 p-2 bg-white rounded border text-sm">
                    <div className="text-gray-600">
                      <strong>Current Billing Weight:</strong>
                      <span className="ml-1 font-semibold text-blue-600">
                        {calculation.finalWeight.toFixed(3)}g
                      </span>
                      {calculation.billingWeightOption ? " (includes stones)" : " (pure gold only)"}
                    </div>
                  </div>
                </div>

                {/* Advance Gold Usage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Advance Gold Used (grams)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={calculation.advanceGoldUsed}
                    onChange={(e) => handleCalculationChange('advanceGoldUsed', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="e.g., 2.000"
                  />
                  <div className="mt-1 text-sm text-gray-500">
                    Amount of advance gold stock to use for this bill. Will be deducted from customer&apos;s advance.
                  </div>
                  {calculation.advanceGoldUsed > 0 && (
                    <div className="mt-2 p-2 bg-green-50 rounded border text-sm">
                      <div className="text-green-700">
                        <strong>Net Amount Customer Owes:</strong>
                        <span className="ml-1 font-semibold">
                          {Math.max(0, calculation.finalWeight - calculation.advanceGoldUsed).toFixed(3)}g
                        </span>
                        <span className="text-gray-600 ml-1">
                          ({calculation.finalWeight.toFixed(3)}g - {calculation.advanceGoldUsed.toFixed(3)}g advance)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Billing Summary */}
                <div className="p-3 bg-white rounded border">
                  <h5 className="font-medium text-gray-900 mb-2">📋 Final Billing Summary:</h5>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Billing Method:</span>
                      <span className="font-medium">
                        {calculation.billingWeightOption ? "Include Stones" : "Pure Gold Only"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Billing Weight:</span>
                      <span className="font-medium text-blue-600">{calculation.finalWeight.toFixed(3)}g</span>
                    </div>
                    {calculation.advanceGoldUsed > 0 && (
                      <div className="flex justify-between">
                        <span>Less: Advance Gold Used:</span>
                        <span className="font-medium text-green-600">-{calculation.advanceGoldUsed.toFixed(3)}g</span>
                      </div>
                    )}
                    <hr className="my-2" />
                    <div className="flex justify-between text-lg font-bold text-orange-600">
                      <span>Net Customer Payment:</span>
                      <span>{Math.max(0, calculation.finalWeight - calculation.advanceGoldUsed).toFixed(3)}g</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Item Details */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-medium text-gray-900">📝 Item Details</h4>
                <button
                  type="button"
                  onClick={addItemDetail}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {formData.itemDetails.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItemDetail(index, 'description', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Particulars"
                      value={item.particulars}
                      onChange={(e) => updateItemDetail(index, 'particulars', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => updateItemDetail(index, 'rate', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    {formData.itemDetails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemDetail(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Terms and Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Terms and Conditions</label>
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

            {/* Submit Buttons */}
            <div className="flex items-center space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading || calculation.finalWeight <= 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-md font-medium flex items-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  '✅ Create Bill'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
            </div>

            {selectedCustomer && calculation.finalWeight > 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800">
                  <strong>📋 Summary:</strong> Bill will be created for <strong>{selectedCustomer.name}</strong>
                  with final weight <strong>{calculation.finalWeight.toFixed(3)}g</strong> added to customer stock.
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateCustomerBill
