'use client'

import { useState, useEffect } from 'react'

interface EnhancedRecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (makingCharge: number, recoveryAmount: number, description: string) => Promise<void>
  isLoading: boolean
  karigarName: string
  filteredData: {
    totalLoss: number
    alreadyRecovered: number
    remainingLoss: number
    orderCount: number
    karatType?: string
  }
}

const EnhancedRecoveryModal: React.FC<EnhancedRecoveryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  karigarName,
  filteredData
}) => {
  const [makingCharge, setMakingCharge] = useState('')
  const [recoveryAmount, setRecoveryAmount] = useState('')
  const [description, setDescription] = useState('')
  const [recoveryType, setRecoveryType] = useState<'full' | 'partial'>('full')

  // Calculate values
  const totalLoss = filteredData.totalLoss || 0
  const alreadyRecovered = filteredData.alreadyRecovered || 0
  const remainingLoss = filteredData.remainingLoss || 0
  const makingChargeNum = parseFloat(makingCharge) || 0
  const newTotalLoss = Math.max(0, remainingLoss - makingChargeNum)
  const recoveryAmountNum = parseFloat(recoveryAmount) || 0
  const finalPendingLoss = Math.max(0, newTotalLoss - recoveryAmountNum)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMakingCharge('')
      setRecoveryAmount('')
      setDescription('')
      setRecoveryType('full')
    }
  }, [isOpen])

  // Auto-set recovery amount when recovery type changes
  useEffect(() => {
    if (recoveryType === 'full') {
      setRecoveryAmount(newTotalLoss.toString())
    } else {
      setRecoveryAmount('')
    }
  }, [recoveryType, newTotalLoss])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (makingChargeNum < 0) {
      alert('Making charge cannot be negative')
      return
    }
    
    if (recoveryAmountNum < 0) {
      alert('Recovery amount cannot be negative')
      return
    }
    
    if (recoveryAmountNum > newTotalLoss) {
      alert('Recovery amount cannot exceed the adjusted loss amount')
      return
    }
    
    if (!description.trim()) {
      alert('Please provide a description for this recovery')
      return
    }

    try {
      await onSubmit(makingChargeNum, recoveryAmountNum, description.trim())
      onClose()
    } catch (error) {
      console.error('Recovery submission failed:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-gray-900">
              💰 Gold Loss Recovery - {karigarName}
            </h3>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current Status */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="text-lg font-semibold text-blue-900 mb-3">📊 Current Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white p-3 rounded border border-blue-200">
                <p className="text-gray-600 text-xs mb-1">Total Loss</p>
                <p className="font-bold text-red-600">{totalLoss.toFixed(3)}g</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-200">
                <p className="text-gray-600 text-xs mb-1">Already Recovered</p>
                <p className="font-bold text-green-600">{alreadyRecovered.toFixed(3)}g</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-200">
                <p className="text-gray-600 text-xs mb-1">Remaining Loss</p>
                <p className="font-bold text-purple-600">{remainingLoss.toFixed(3)}g</p>
              </div>
            </div>
            <div className="mt-3 text-center bg-white p-2 rounded border border-blue-200">
              <p className="text-gray-600 text-xs mb-1">Orders in Scope</p>
              <p className="font-bold text-blue-700">{filteredData.orderCount} orders</p>
              {filteredData.karatType && (
                <p className="text-xs text-gray-500">({filteredData.karatType} karat only)</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Making Charge */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-orange-900 mb-3">
                Step 1: Karigar Making Charge
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Making Charge (grams) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={makingCharge}
                  onChange={(e) => setMakingCharge(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter making charge amount (e.g., 2.000)"
                />
                <p className="mt-1 text-xs text-gray-600">
                  Amount that {karigarName} will keep for their work
                </p>
              </div>
            </div>

            {/* Step 2: Adjusted Loss Calculation */}
            {makingChargeNum > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-purple-900 mb-3">
                  Step 2: Adjusted Loss Calculation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white p-3 rounded border border-purple-200 text-center">
                    <p className="text-gray-600 text-xs mb-1">Remaining Loss</p>
                    <p className="font-bold text-red-600">{remainingLoss.toFixed(3)}g</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-purple-200 text-center">
                    <p className="text-gray-600 text-xs mb-1">Making Charge</p>
                    <p className="font-bold text-orange-600">{makingChargeNum.toFixed(3)}g</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-purple-200 text-center">
                    <p className="text-gray-600 text-xs mb-1">New Total Loss</p>
                    <p className="font-bold text-purple-600">{newTotalLoss.toFixed(3)}g</p>
                  </div>
                </div>
                <p className="text-center mt-2 text-sm text-gray-600">
                  New Total Loss = Remaining Loss - Making Charge
                </p>
              </div>
            )}

            {/* Step 3: Recovery Type */}
            {newTotalLoss > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-green-900 mb-3">
                  Step 3: Recovery Type
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="full"
                        checked={recoveryType === 'full'}
                        onChange={(e) => setRecoveryType(e.target.value as 'full')}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">
                        Full Recovery ({newTotalLoss.toFixed(3)}g) - Complete settlement
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="partial"
                        checked={recoveryType === 'partial'}
                        onChange={(e) => setRecoveryType(e.target.value as 'partial')}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">
                        Partial Recovery - Specify amount
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Recovery Amount */}
            {newTotalLoss > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-yellow-900 mb-3">
                  Step 4: Recovery Amount
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recovery Amount (grams) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={newTotalLoss}
                    required
                    value={recoveryAmount}
                    onChange={(e) => setRecoveryAmount(e.target.value)}
                    disabled={recoveryType === 'full'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 disabled:bg-gray-100"
                    placeholder={recoveryType === 'full' ? 'Auto-calculated for full recovery' : 'Enter partial recovery amount'}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                    <span>Maximum recoverable: {newTotalLoss.toFixed(3)}g</span>
                    <span>Remaining after recovery: {finalPendingLoss.toFixed(3)}g</span>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description/Reason *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe the reason for this recovery (e.g., 'Weekly recovery for filing processes', 'Monthly settlement for 22k orders')"
              />
            </div>

            {/* Summary */}
            {recoveryAmountNum > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">📋 Recovery Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Making Charge</p>
                    <p className="font-bold text-orange-600">{makingChargeNum.toFixed(3)}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Recovery Amount</p>
                    <p className="font-bold text-green-600">{recoveryAmountNum.toFixed(3)}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Total Settled</p>
                    <p className="font-bold text-blue-600">{(makingChargeNum + recoveryAmountNum).toFixed(3)}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Still Pending</p>
                    <p className="font-bold text-purple-600">{finalPendingLoss.toFixed(3)}g</p>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-blue-100 rounded text-center">
                  <p className="text-sm text-blue-800">
                    <strong>Fine Gold to be Added:</strong> {(() => {
                      let purity = 0.92 // Default 22k
                      if (filteredData.karatType === '18k') purity = 0.755
                      else if (filteredData.karatType === '19.2k') purity = 0.80
                      else if (filteredData.karatType === '14.2k' || filteredData.karatType === '14k') purity = 0.59
                      else if (filteredData.karatType === '9k') purity = 0.375
                      return (recoveryAmountNum * purity).toFixed(3)
                    })()}g
                    {filteredData.karatType && ` (${filteredData.karatType} → Fine conversion)`}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 px-6 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !makingCharge || !recoveryAmount || !description}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-md font-medium flex items-center space-x-2"
              >
                {isLoading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{isLoading ? 'Processing...' : 'Complete Recovery'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EnhancedRecoveryModal
