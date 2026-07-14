'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Order {
  id: string
  orderName: string
  customerId: string
  customerGoldWeight: number
  adminGoldWeight: number
  totalGoldUsed: number
  finalJewelryWeight: number
  status: string
  createdAt: string
}

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
}

interface OrderBillingPageProps {
  orderId: string
}

const OrderBillingPage: React.FC<OrderBillingPageProps> = ({ orderId }) => {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [billingForm, setBillingForm] = useState({
    actualWeight: '',
    stoneWeight: '',
    includeStone: false,
    adWeight: '',
    includeAd: false,
    manufacturingCostAmount: '',
    manufacturingCostType: 'MONEY' as 'MONEY' | 'GOLD'
  })

  useEffect(() => {
    fetchOrderData()
  }, [orderId])

  const fetchOrderData = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      if (response.ok) {
        const data = await response.json()
        setOrder(data.order)
        setCustomer(data.customer)
        
        // Initialize form with order data
        if (data.order) {
          setBillingForm({
            actualWeight: data.order.finalJewelryWeight.toString() || '',
            stoneWeight: '0',
            includeStone: false,
            adWeight: '0',
            includeAd: false,
            manufacturingCostAmount: '0',
            manufacturingCostType: 'MONEY'
          })
        }
      } else {
        console.error('Order not found')
        router.push('/orders')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setBillingForm({
        ...billingForm,
        [name]: (e.target as HTMLInputElement).checked
      })
    } else {
      setBillingForm({
        ...billingForm,
        [name]: value
      })
    }
  }

  // Calculate final billing weight including stones if selected
  const getFinalBillingWeight = () => {
    const actualWeight = parseFloat(billingForm.actualWeight) || 0
    const stoneWeight = billingForm.includeStone ? parseFloat(billingForm.stoneWeight) || 0 : 0
    const adWeight = billingForm.includeAd ? parseFloat(billingForm.adWeight) || 0 : 0
    return actualWeight + stoneWeight + adWeight
  }

  // Calculate manufacturing cost in grams
  const getManufacturingCostInGrams = () => {
    const amount = parseFloat(billingForm.manufacturingCostAmount) || 0
    if (billingForm.manufacturingCostType === 'MONEY') {
      return 0 // Money cost doesn't add to gold weight
    }
    return amount // Gold cost adds to total gold owed
  }

  // Calculate total customer owes in grams
  const getTotalCustomerOwes = () => {
    return getFinalBillingWeight() + getManufacturingCostInGrams()
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
        <h2 className="text-2xl font-bold text-gray-900">Order not found</h2>
        <Link href="/orders" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          ← Back to Orders
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/orders" className="text-blue-600 hover:text-blue-800">
            ← Back to Orders
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Bill</h1>
            <p className="text-gray-600">{order.orderName}</p>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Customer</label>
            <p className="text-gray-900 font-semibold">{customer?.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Order Status</label>
            <p className="text-gray-900 font-semibold">{order.status}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Original Weight</label>
            <p className="text-gray-900">{order.totalGoldUsed.toFixed(3)}g</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Final Jewelry Weight</label>
            <p className="text-gray-900 font-bold text-blue-600">{order.finalJewelryWeight.toFixed(3)}g</p>
          </div>
        </div>
      </div>

      {/* Billing Form */}
      {order.status === 'COMPLETED' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create Customer Bill</h2>
          
          <div className="space-y-6">
            {/* Step 1: Actual Weight */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">1. Actual Order Weight</h3>
              <p className="text-sm text-gray-600 mb-3">Enter the actual weight the order was completed in</p>
              <div className="w-full max-w-xs">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  name="actualWeight"
                  value={billingForm.actualWeight}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter actual weight in grams"
                />
                <p className="text-xs text-gray-500 mt-1">Example: Order can be completed in 9g, 10g, or 10.2g - enter actual weight</p>
              </div>
            </div>

            {/* Step 2: Stone Weight (Kales) and Ad Weight */}
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">2. Stone Weight Inclusion (Kales & Ad Weight)</h3>
              <p className="text-sm text-gray-600 mb-3">Include stones and ad weight in billing by adding them manually to the final weight</p>
              
              {/* Kales Stone Weight */}
              <div className="space-y-3 mb-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    name="includeStone"
                    checked={billingForm.includeStone}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-900 font-medium">🪨 Include Kales (stone) weight in billing</span>
                </label>
                
                {billingForm.includeStone && (
                  <div className="w-full max-w-xs ml-7">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      name="stoneWeight"
                      value={billingForm.stoneWeight}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Enter kales weight"
                    />
                    <p className="text-xs text-gray-500 mt-1">Weight of kales (stones) to add to billing</p>
                  </div>
                )}
              </div>

              {/* Ad Weight */}
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    name="includeAd"
                    checked={billingForm.includeAd}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-900 font-medium">⚙️ Include Ad weight in billing</span>
                </label>
                
                {billingForm.includeAd && (
                  <div className="w-full max-w-xs ml-7">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      name="adWeight"
                      value={billingForm.adWeight}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Enter ad weight"
                    />
                    <p className="text-xs text-gray-500 mt-1">Weight of ad (other materials) to add to billing</p>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Manufacturing Cost */}
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">3. Manufacturing Cost</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cost Type</label>
                  <select
                    name="manufacturingCostType"
                    value={billingForm.manufacturingCostType}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="MONEY">Money (₹)</option>
                    <option value="GOLD">Gold Weight (g)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {billingForm.manufacturingCostType === 'MONEY' ? 'Amount (₹)' : 'Gold Weight (g)'}
                  </label>
                  <input
                    type="number"
                    step={billingForm.manufacturingCostType === 'MONEY' ? '1' : '0.001'}
                    min="0"
                    name="manufacturingCostAmount"
                    value={billingForm.manufacturingCostAmount}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder={billingForm.manufacturingCostType === 'MONEY' ? 'Enter amount' : 'Enter weight'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {billingForm.manufacturingCostType === 'MONEY' 
                      ? 'Manufacturing cost in rupees (customer pays separately)' 
                      : 'Manufacturing cost in gold (added to total gold owed)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bill Preview */}
            {billingForm.actualWeight && (
              <div className="bg-gray-50 p-6 rounded-lg border">
                <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Customer Bill Summary</h3>
                
                <div className="space-y-4">
                  {/* Weight Calculation */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900 mb-3">Weight Calculation:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Actual Order Weight:</span>
                        <span className="font-medium text-blue-600">{parseFloat(billingForm.actualWeight).toFixed(3)}g</span>
                      </div>
                      {billingForm.includeStone && (
                        <div className="flex justify-between">
                          <span>Plus Kales (Stone) Weight:</span>
                          <span className="font-medium text-green-600">+{parseFloat(billingForm.stoneWeight || '0').toFixed(3)}g</span>
                        </div>
                      )}
                      {billingForm.includeAd && (
                        <div className="flex justify-between">
                          <span>Plus Ad Weight:</span>
                          <span className="font-medium text-green-600">+{parseFloat(billingForm.adWeight || '0').toFixed(3)}g</span>
                        </div>
                      )}
                      <hr />
                      <div className="flex justify-between font-bold">
                        <span>Final Billing Weight:</span>
                        <span className="text-green-600">{getFinalBillingWeight().toFixed(3)}g</span>
                      </div>
                    </div>
                  </div>

                  {/* Manufacturing Cost */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900 mb-3">Manufacturing Cost:</h4>
                    <div className="text-sm">
                      {billingForm.manufacturingCostType === 'MONEY' ? (
                        <div className="flex justify-between font-bold">
                          <span>Customer Pays:</span>
                          <span className="text-blue-600">₹{parseFloat(billingForm.manufacturingCostAmount || '0').toFixed(0)} (Money)</span>
                        </div>
                      ) : (
                        <div className="flex justify-between font-bold">
                          <span>Additional Gold Cost:</span>
                          <span className="text-orange-600">+{parseFloat(billingForm.manufacturingCostAmount || '0').toFixed(3)}g</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Total Summary */}
                  <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                    <h4 className="font-bold text-blue-900 mb-3">💰 Total Customer Owes:</h4>
                    <div className="space-y-1">
                      <div className="text-lg font-bold text-blue-600">
                        🥇 {getTotalCustomerOwes().toFixed(3)}g Gold
                      </div>
                      {billingForm.manufacturingCostType === 'MONEY' && parseFloat(billingForm.manufacturingCostAmount || '0') > 0 && (
                        <div className="text-lg font-bold text-green-600">
                          💰 ₹{parseFloat(billingForm.manufacturingCostAmount || '0').toFixed(0)} Money
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 p-3 bg-white rounded border-l-4 border-blue-500">
                      <p className="text-xs text-gray-600">
                        <strong>Calculation:</strong> {parseFloat(billingForm.actualWeight || '0').toFixed(3)}g actual
                        {billingForm.includeStone && ` + ${parseFloat(billingForm.stoneWeight || '0').toFixed(3)}g kales`}
                        {billingForm.includeAd && ` + ${parseFloat(billingForm.adWeight || '0').toFixed(3)}g ad`}
                        {billingForm.manufacturingCostType === 'GOLD' && getManufacturingCostInGrams() > 0 && 
                          ` + ${getManufacturingCostInGrams().toFixed(3)}g manufacturing`
                        } = <strong>{getTotalCustomerOwes().toFixed(3)}g total gold</strong>
                        {billingForm.manufacturingCostType === 'MONEY' && parseFloat(billingForm.manufacturingCostAmount || '0') > 0 && 
                          ` + ₹${parseFloat(billingForm.manufacturingCostAmount || '0').toFixed(0)} cash`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Not Completed Message */}
      {order.status !== 'COMPLETED' && (
        <div className="bg-gray-50 p-6 rounded-lg">
          <p className="text-gray-600">Billing is only available for completed orders. Current status: <strong>{order.status}</strong></p>
        </div>
      )}
    </div>
  )
}

export default OrderBillingPage
