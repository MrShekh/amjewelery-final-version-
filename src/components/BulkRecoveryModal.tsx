'use client'

import { useState } from 'react'

interface BulkRecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (recoveryData: {
    processType: string
    recoveredAmount: number
    recoveryPeriod: string
    description: string
  }) => Promise<void>
  processType: string
  totalPendingLoss: number
  totalRecovered: number
  processCount: number
  karigarName: string
  isLoading?: boolean
}

const BulkRecoveryModal: React.FC<BulkRecoveryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  processType,
  totalPendingLoss,
  totalRecovered,
  processCount,
  karigarName,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    recoveredAmount: '',
    recoveryPeriod: getDefaultRecoveryPeriod(processType),
    description: ''
  })

  // Get default recovery period based on process type
  function getDefaultRecoveryPeriod(processType: string): string {
    switch (processType) {
      case 'FILING':
      case 'STONE_SETTING':
        return 'Weekly'
      case 'FINAL_POLISH':
      case 'FREE_POLISH':
        return 'Monthly'
      default:
        return 'Weekly'
    }
  }

  // Get process type display name
  function getProcessTypeDisplayName(processType: string): string {
    switch (processType) {
      case 'FILING':
        return 'Filing'
      case 'STONE_SETTING':
        return 'Stone Setting'
      case 'FINAL_POLISH':
        return 'Final Polish'
      case 'FREE_POLISH':
        return 'Free Polish'
      default:
        return processType.replace('_', ' ')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const recoveryAmount = parseFloat(formData.recoveredAmount)
    if (isNaN(recoveryAmount) || recoveryAmount <= 0) {
      alert('Please enter a valid recovery amount greater than 0')
      return
    }

    if (recoveryAmount > totalPendingLoss) {
      alert(`Recovery amount (${recoveryAmount}g) cannot exceed pending loss (${totalPendingLoss.toFixed(3)}g)`)
      return
    }

    await onSubmit({
      processType,
      recoveredAmount: recoveryAmount,
      recoveryPeriod: formData.recoveryPeriod,
      description: formData.description || `${formData.recoveryPeriod} ${getProcessTypeDisplayName(processType).toLowerCase()} recovery`
    })

    // Reset form
    setFormData({
      recoveredAmount: '',
      recoveryPeriod: getDefaultRecoveryPeriod(processType),
      description: ''
    })
  }

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        recoveredAmount: '',
        recoveryPeriod: getDefaultRecoveryPeriod(processType),
        description: ''
      })
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              🔄 Bulk {getProcessTypeDisplayName(processType)} Recovery
            </h3>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary Information */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Recovery Summary for {karigarName}</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Process Type:</span>
                <span className="font-medium">{getProcessTypeDisplayName(processType)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Orders Affected:</span>
                <span className="font-medium">{processCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Already Recovered:</span>
                <span className="font-medium text-green-600">{totalRecovered.toFixed(3)}g</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-medium text-gray-900">Pending Recovery:</span>
                <span className="font-bold text-red-600">{totalPendingLoss.toFixed(3)}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Recovery Schedule:</span>
                <span className="font-medium text-blue-600">{getDefaultRecoveryPeriod(processType)}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Recovery Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recovery Amount (grams) *
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                max={totalPendingLoss}
                value={formData.recoveredAmount}
                onChange={(e) => setFormData({ ...formData, recoveredAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="0.000"
                disabled={isLoading}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {totalPendingLoss.toFixed(3)}g
              </p>
            </div>

            {/* Recovery Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recovery Period *
              </label>
              <select
                value={formData.recoveryPeriod}
                onChange={(e) => setFormData({ ...formData, recoveryPeriod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                disabled={isLoading}
                required
              >
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="One-time">One-time</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder={`${formData.recoveryPeriod} ${getProcessTypeDisplayName(processType).toLowerCase()} recovery`}
                disabled={isLoading}
              />
            </div>

            {/* Quick Amount Buttons */}
            {totalPendingLoss > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Amount Selection:
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, recoveredAmount: (totalPendingLoss * 0.25).toFixed(3) })}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                    disabled={isLoading}
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, recoveredAmount: (totalPendingLoss * 0.5).toFixed(3) })}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                    disabled={isLoading}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, recoveredAmount: (totalPendingLoss * 0.75).toFixed(3) })}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                    disabled={isLoading}
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, recoveredAmount: totalPendingLoss.toFixed(3) })}
                    className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2 rounded-md text-sm font-medium"
                    disabled={isLoading}
                  >
                    100%
                  </button>
                </div>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex items-center space-x-4 pt-4">
              <button
                type="submit"
                disabled={isLoading || !formData.recoveredAmount || parseFloat(formData.recoveredAmount) <= 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-md font-medium"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Recording...
                  </div>
                ) : (
                  '💎 Record Recovery'
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Info Note */}
          <div className="mt-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> This will update all {processType.replace('_', ' ').toLowerCase()} processes for this karigar. 
              Recovery amounts are distributed across processes chronologically.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BulkRecoveryModal
