'use client'

import React, { useState, useEffect } from 'react'

interface OrderDetails {
  id: string
  orderName: string
  orderPhoto?: string
  customerGoldWeight: number
  adminGoldWeight: number
  totalGoldUsed: number
  finalJewelryWeight: number
  actualFinalWeight?: number
  actualGoldWeight?: number
  totalStoneWeight?: number
  selectedKarat?: number
  customerAdvanceGold?: number
  totalWeightLoss: number
  processes: Array<{
    id: string
    processType: string
    inputWeight: number
    outputWeight: number
    goldLoss: number
    goldRecovered?: number
    karigar: { name: string }
  }>
}

interface GoldCalculation {
  originalGoldProvided: number
  totalGoldLoss: number
  totalGoldRecovered: number
  actualGoldInJewelry: number
  actualGoldInFineGold: number
  advanceGoldUsed: number
  manufacturingCharges: number
  totalCustomerOwes: number
  alreadyCollected: number
  remainingToCollect: number
}

interface GoldCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  order: OrderDetails
  customerName: string
  customerId: string
  onCollectionComplete: () => void
}

export const GoldCollectionModal: React.FC<GoldCollectionModalProps> = ({
  isOpen,
  onClose,
  order,
  customerName,
  customerId,
  onCollectionComplete
}) => {
  const [calculation, setCalculation] = useState<GoldCalculation | null>(null)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [existingBalance, setExistingBalance] = useState<any>(null)
  const [makingCharges, setMakingCharges] = useState<number>(0)

  useEffect(() => {
    if (isOpen && order) {
      calculateGoldDetails()
    }
  }, [isOpen, order])

  useEffect(() => {
    if (calculation) {
      recalculateWithMakingCharges()
    }
  }, [makingCharges])

  const recalculateWithMakingCharges = () => {
    if (!calculation) return

    const karatPurity = (order.selectedKarat || 92) / 100
    const actualGoldInFineGold = calculation.actualGoldInJewelry * karatPurity
    const advanceGoldUsed = order.customerAdvanceGold || 0
    
    // CORRECTED CALCULATION: (fine gold + making charges) - advance gold
    const totalRequired = actualGoldInFineGold + makingCharges
    const totalCustomerOwes = Math.max(0, totalRequired - advanceGoldUsed)
    
    const alreadyCollected = existingBalance ? (existingBalance.jamaGoldAmount - existingBalance.pendingAmount) : 0
    const remainingToCollect = existingBalance?.pendingAmount || totalCustomerOwes
    
    setCalculation({
      ...calculation,
      manufacturingCharges: makingCharges,
      totalCustomerOwes,
      remainingToCollect
    })
  }

  const calculateGoldDetails = async () => {
    setLoading(true)
    try {
      // Fetch customer jama balance for this order
      const customerResponse = await fetch(`/api/customers/${customerId}`)
      if (customerResponse.ok) {
        const customerData = await customerResponse.json()
        const orderBalance = customerData.customer?.jamaGold?.balances?.find(
          (balance: any) => balance.orderId === order.id
        )
        setExistingBalance(orderBalance)
      }

      // Calculate gold details
      const karatPurity = (order.selectedKarat || 92) / 100
      const totalGoldLoss = order.processes.reduce((sum, process) => sum + process.goldLoss, 0)
      const totalGoldRecovered = order.processes.reduce((sum, process) => sum + (process.goldRecovered || 0), 0)
      
      const actualGoldInJewelry = order.actualGoldWeight || order.finalJewelryWeight - (order.totalStoneWeight || 0)
      const actualGoldInFineGold = actualGoldInJewelry * karatPurity
      
      const advanceGoldUsed = order.customerAdvanceGold || 0
      const manufacturingCharges = 0 // This should come from billing data
      
      // Total customer owes = actual gold in jewelry + manufacturing charges - advance gold used
      const totalCustomerOwes = Math.max(0, actualGoldInFineGold + manufacturingCharges - advanceGoldUsed)
      
      const alreadyCollected = existingBalance ? (existingBalance.jamaGoldAmount - existingBalance.pendingAmount) : 0
      const remainingToCollect = existingBalance?.pendingAmount || totalCustomerOwes

      const goldCalculation: GoldCalculation = {
        originalGoldProvided: order.customerGoldWeight + order.adminGoldWeight,
        totalGoldLoss,
        totalGoldRecovered,
        actualGoldInJewelry,
        actualGoldInFineGold,
        advanceGoldUsed,
        manufacturingCharges,
        totalCustomerOwes,
        alreadyCollected,
        remainingToCollect
      }

      setCalculation(goldCalculation)
    } catch (error) {
      console.error('Error calculating gold details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCollectGold = async () => {
    if (!calculation || !existingBalance) return

    setCollecting(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      
      const collectResponse = await fetch(`/api/customers/${customerId}/jama-gold`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          returnAmount: calculation.remainingToCollect,
          description: `Gold collection for order "${order.orderName}" - Customer: ${customerName}`
        })
      })

      if (!collectResponse.ok) {
        const error = await collectResponse.json()
        throw new Error(error.error || 'Failed to collect gold')
      }

      const result = await collectResponse.json()
      
      // Show success message with details
      alert(`✅ Gold Collection Successful!

Order: ${order.orderName}
Customer: ${customerName}
Amount Collected: ${calculation.remainingToCollect.toFixed(3)}g fine gold

Gold has been transferred from Customer Stock to Admin Stock.

Transaction ID: ${result.transactionId || 'N/A'}`)
      
      onCollectionComplete()
      onClose()
      
    } catch (error) {
      console.error('Error collecting gold:', error)
      alert(`❌ Failed to collect gold: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCollecting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Gold Collection Details</h3>
                <p className="text-gray-600">Order: {order.orderName} • Customer: {customerName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              <span className="ml-3 text-gray-600">Calculating gold details...</span>
            </div>
          ) : calculation ? (
            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4 mb-4">
                  {order.orderPhoto && (
                    <img 
                      src={order.orderPhoto} 
                      alt={order.orderName}
                      className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">{order.orderName}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
                      <div>
                        <span className="text-gray-500">Order ID:</span>
                        <p className="font-medium">#{order.id.slice(-8)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Gold Purity:</span>
                        <p className="font-medium">{order.selectedKarat || 92}% ({((order.selectedKarat || 92)/100*24).toFixed(1)}K)</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Final Weight:</span>
                        <p className="font-medium">{(order.actualFinalWeight || order.finalJewelryWeight).toFixed(3)}g</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Processes:</span>
                        <p className="font-medium">{order.processes.length} completed</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Making Charges Input */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl">⚙️</span>
                  <h4 className="text-lg font-semibold text-orange-900">Making Charges</h4>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="text-orange-800 font-medium">Enter making charges (fine gold):</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={makingCharges}
                      onChange={(e) => setMakingCharges(parseFloat(e.target.value) || 0)}
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      className="w-32 px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-orange-700 font-medium">g</span>
                  </div>
                </div>
                <p className="text-orange-600 text-sm mt-2">
                  💡 This is the additional fine gold charge for manufacturing the jewelry
                </p>
              </div>

              {/* Manufacturing Process Breakdown */}
              <div className="bg-white border rounded-lg">
                <div className="px-4 py-3 border-b bg-blue-50">
                  <h4 className="text-lg font-semibold text-blue-900">🔧 Manufacturing Process Breakdown</h4>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {order.processes.map((process, index) => (
                      <div key={process.id} className="bg-gray-50 p-3 rounded-md">
                        <div className="font-medium text-gray-900">{process.processType}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          <div>In: {process.inputWeight.toFixed(3)}g</div>
                          <div>Out: {process.outputWeight.toFixed(3)}g</div>
                          <div className="text-red-600">Loss: {process.goldLoss.toFixed(3)}g</div>
                          {process.goldRecovered && process.goldRecovered > 0 && (
                            <div className="text-green-600">Recovered: {process.goldRecovered.toFixed(3)}g</div>
                          )}
                          <div className="text-blue-600 text-xs">{process.karigar.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <div className="bg-red-50 p-3 rounded-md text-center">
                      <div className="text-2xl font-bold text-red-600">{calculation.totalGoldLoss.toFixed(3)}g</div>
                      <div className="text-sm text-red-700">Total Gold Loss</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-md text-center">
                      <div className="text-2xl font-bold text-green-600">{calculation.totalGoldRecovered.toFixed(3)}g</div>
                      <div className="text-sm text-green-700">Gold Recovered</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-md text-center">
                      <div className="text-2xl font-bold text-blue-600">{calculation.actualGoldInJewelry.toFixed(3)}g</div>
                      <div className="text-sm text-blue-700">Gold in Final Jewelry</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gold Calculation Summary */}
              <div className="bg-white border rounded-lg">
                <div className="px-4 py-3 border-b bg-green-50">
                  <h4 className="text-lg font-semibold text-green-900">💰 Gold Settlement Calculation</h4>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Customer Gold Provided:</span>
                        <span className="font-medium">{order.customerGoldWeight.toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Admin Gold Added:</span>
                        <span className="font-medium">{order.adminGoldWeight.toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Total Gold Used:</span>
                        <span className="font-medium">{order.totalGoldUsed.toFixed(3)}g</span>
                      </div>
                      {calculation.advanceGoldUsed > 0 && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600">Less: Advance Gold Used:</span>
                          <span className="font-medium text-green-600">-{calculation.advanceGoldUsed.toFixed(3)}g</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Actual Gold in Jewelry ({order.selectedKarat || 92}%):</span>
                        <span className="font-medium">{calculation.actualGoldInJewelry.toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Converted to Fine Gold:</span>
                        <span className="font-medium">{calculation.actualGoldInFineGold.toFixed(3)}g</span>
                      </div>
                      {calculation.manufacturingCharges > 0 && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600">Manufacturing Charges:</span>
                          <span className="font-medium text-orange-600">+{calculation.manufacturingCharges.toFixed(3)}g</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calculation Formula */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <h5 className="text-lg font-semibold text-blue-900 mb-3">📊 Calculation Breakdown</h5>
                    <div className="text-sm text-blue-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Fine Gold in Jewelry:</span>
                        <span className="font-medium">{calculation.actualGoldInFineGold.toFixed(3)}g</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>+ Making Charges:</span>
                        <span className="font-medium">{calculation.manufacturingCharges.toFixed(3)}g</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-blue-300 pt-1 font-medium">
                        <span>Total Required:</span>
                        <span>{(calculation.actualGoldInFineGold + calculation.manufacturingCharges).toFixed(3)}g</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>- Advance Gold Used:</span>
                        <span className="font-medium text-green-700">{calculation.advanceGoldUsed.toFixed(3)}g</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-blue-300 pt-1 font-bold text-lg">
                        <span>Customer Owes:</span>
                        <span className="text-orange-600">{calculation.totalCustomerOwes.toFixed(3)}g</span>
                      </div>
                    </div>
                  </div>

                  {/* Final Calculation */}
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg p-4 mt-6">
                    <div className="text-center mb-4">
                      <h5 className="text-xl font-bold text-orange-900">Final Gold Collection Amount</h5>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-white p-3 rounded-md">
                        <div className="text-2xl font-bold text-blue-600">{calculation.totalCustomerOwes.toFixed(3)}g</div>
                        <div className="text-sm text-gray-600">Total Customer Owes (Fine Gold)</div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-md">
                        <div className="text-2xl font-bold text-green-600">{calculation.alreadyCollected.toFixed(3)}g</div>
                        <div className="text-sm text-gray-600">Already Collected</div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-md border-2 border-orange-300">
                        <div className="text-3xl font-bold text-orange-600">{calculation.remainingToCollect.toFixed(3)}g</div>
                        <div className="text-sm text-orange-700 font-medium">Remaining to Collect</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Collection Status */}
              {existingBalance ? (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                      <h5 className="font-semibold text-yellow-800">Collection Status</h5>
                      <p className="text-yellow-700 text-sm mt-1">
                        This order has a pending gold balance of <strong>{existingBalance.pendingAmount.toFixed(3)}g fine gold</strong> 
                        in the customer's account that needs to be collected.
                      </p>
                      {existingBalance.description && (
                        <p className="text-yellow-600 text-xs mt-2">
                          Note: {existingBalance.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h5 className="font-semibold text-red-800">No Pending Balance Found</h5>
                      <p className="text-red-700 text-sm mt-1">
                        No pending gold balance found for this order. This may mean:
                      </p>
                      <ul className="text-red-600 text-sm mt-2 space-y-1">
                        <li>• The order hasn't been billed yet</li>
                        <li>• The gold has already been collected</li>
                        <li>• The order was fully settled with advance gold</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md font-medium transition-colors"
                >
                  Cancel
                </button>
                
                {existingBalance && calculation.remainingToCollect > 0 ? (
                  <button
                    onClick={handleCollectGold}
                    disabled={collecting}
                    className="px-8 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white rounded-md font-medium transition-colors flex items-center space-x-2"
                  >
                    {collecting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Collecting...</span>
                      </>
                    ) : (
                      <>
                        <span>💎</span>
                        <span>Collect {calculation.remainingToCollect.toFixed(3)}g Gold</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-8 py-3 bg-gray-300 text-gray-500 rounded-md font-medium cursor-not-allowed"
                  >
                    No Gold to Collect
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="text-red-600 text-lg">Failed to calculate gold details</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
