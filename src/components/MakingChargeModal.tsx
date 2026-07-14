'use client'

import { useState, useEffect } from 'react'

interface MakingChargeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (amount: number, description: string) => void
  totalLoss: number
  currentMakingCharge: number
  karigarName: string
  isLoading?: boolean
}

const MakingChargeModal: React.FC<MakingChargeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  totalLoss,
  currentMakingCharge,
  karigarName,
  isLoading = false
}) => {
  const [makingChargeAmount, setMakingChargeAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setMakingChargeAmount(currentMakingCharge > 0 ? currentMakingCharge.toString() : '')
      setDescription(`Bulk making charge for ${karigarName}`)
      setError('')
    }
  }, [isOpen, currentMakingCharge, karigarName])

  const handleAmountChange = (value: string) => {
    // Only allow numeric input with up to one decimal point and max 6 decimal places
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    let result = parts[0];
    
    if (parts.length > 1) {
      result += '.' + parts[1].substring(0, 6); // Limit to 6 decimal places
    }
    
    setMakingChargeAmount(result);
    setError('');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const amount = parseFloat(makingChargeAmount) || 0
    
    if (amount < 0) {
      setError('Making charge cannot be negative')
      return
    }
    
    if (amount > totalLoss) {
      setError(`Making charge (${amount}g) cannot exceed total loss (${totalLoss.toFixed(3)}g)`)
      return
    }
    
    onSubmit(amount, description)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Set Making Charge
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Karigar:</strong> {karigarName}
          </p>
          <p className="text-sm text-blue-800">
            <strong>Total Loss (All Orders):</strong> {totalLoss.toFixed(3)}g
          </p>
          {currentMakingCharge > 0 && (
            <p className="text-sm text-blue-800">
              <strong>Current Bulk Charge:</strong> {currentMakingCharge.toFixed(3)}g
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Making Charge Amount (grams) *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={makingChargeAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              placeholder="0.000"
              disabled={isLoading}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum: {totalLoss.toFixed(3)}g (total loss for this karigar)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              placeholder="Description for this making charge"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> This will set the bulk making charge for all orders by this karigar. 
              The actual recoverable amount will be automatically calculated as: 
              Total Loss - Making Charge = {(totalLoss - (parseFloat(makingChargeAmount) || 0)).toFixed(3)}g
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !makingChargeAmount}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              {isLoading ? 'Setting...' : 'Set Making Charge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MakingChargeModal
