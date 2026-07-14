'use client'

import { useState, useEffect } from 'react'

interface ProcessLossData {
  type: string
  totalLoss: number
  alreadyRecovered: number
  remainingLoss: number
  karatPurity?: number
}

interface SimpleLossRecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (processType: string, makingCharge: number, actualRecovery: number, description: string) => void
  processData: ProcessLossData
  karigarName: string
  isLoading?: boolean
}

const SimpleLossRecoveryModal: React.FC<SimpleLossRecoveryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  processData,
  karigarName,
  isLoading = false
}) => {
  const [makingCharge, setMakingCharge] = useState('')
  const [actualRecovery, setActualRecovery] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setMakingCharge('')
      setActualRecovery('')
      setDescription(`${getProcessDisplayName(processData.type)} recovery for ${karigarName}`)
      setError('')
    }
  }, [isOpen, processData.type, karigarName])

  const getProcessDisplayName = (type: string): string => {
    switch (type) {
      case 'FILING': return 'Filing'
      case 'FREE_POLISH': return 'Free Polish'
      case 'STONE_SETTING': return 'Stone Setting'
      case 'FINAL_POLISH': return 'Final Polish'
      case 'TOTAL': return 'Total Gold Loss'
      default: return type.replace('_', ' ')
    }
  }

  const getRecoverySchedule = (type: string): string => {
    switch (type) {
      case 'FILING':
      case 'STONE_SETTING':
        return 'Weekly'
      case 'FINAL_POLISH':
      case 'FREE_POLISH':
        return 'Monthly'
      case 'TOTAL':
        return 'Simple'
      default:
        return 'As needed'
    }
  }

  const handleNumberInput = (value: string, setter: (val: string) => void) => {
    // Only allow numeric input with up to one decimal point and max 6 decimal places
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    let result = parts[0];
    
    if (parts.length > 1) {
      result += '.' + parts[1].substring(0, 6); // Limit to 6 decimal places
    }
    
    setter(result);
    setError('');
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    
    console.log('🔄 Form submission triggered')
    console.log('Making charge:', makingCharge)
    console.log('Actual recovery:', actualRecovery)
    console.log('Description:', description)
    
    const makingChargeAmount = parseFloat(makingCharge) || 0
    const recoveryAmount = parseFloat(actualRecovery) || 0
    
    // Validation
    if (makingChargeAmount < 0) {
      setError('Making charge cannot be negative')
      return
    }
    
    if (recoveryAmount < 0) {
      setError('Recovery amount cannot be negative')
      return
    }
    
    if (makingChargeAmount > processData.remainingLoss) {
      setError(`Making charge (${makingChargeAmount}g) cannot exceed remaining loss (${processData.remainingLoss.toFixed(3)}g)`)
      return
    }
    
    const maxRecoverable = processData.remainingLoss - makingChargeAmount
    if (recoveryAmount > maxRecoverable) {
      setError(`Recovery amount (${recoveryAmount}g) cannot exceed available amount (${maxRecoverable.toFixed(3)}g) after making charge`)
      return
    }
    
    console.log('✅ Validation passed, calling onSubmit')
    onSubmit(processData.type, makingChargeAmount, recoveryAmount, description)
  }

  if (!isOpen) return null

  const maxRecoverable = Math.max(0, processData.remainingLoss - (parseFloat(makingCharge) || 0))

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              💰 <span>Simple Loss Recovery</span>
            </h3>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="px-6 py-6">

          {/* Process Info Card */}
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-l-4 border-blue-500 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-bold text-blue-900">{getProcessDisplayName(processData.type)}</h4>
              <span className="text-sm bg-blue-200 text-blue-900 px-3 py-1 rounded-full font-medium">
                {getRecoverySchedule(processData.type)} Recovery
              </span>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center text-blue-800 font-medium">
                <span className="text-lg mr-2">👨‍🔧</span>
                <span>Karigar: {karigarName}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{processData.totalLoss.toFixed(3)}g</p>
                <p className="text-sm text-red-800 font-medium">Total Loss</p>
              </div>
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{processData.alreadyRecovered.toFixed(3)}g</p>
                <p className="text-sm text-green-800 font-medium">Already Recovered</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">{processData.remainingLoss.toFixed(3)}g</p>
                <p className="text-sm text-purple-800 font-medium">Remaining Loss</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Making Charge */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border-l-4 border-orange-500 p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">⚙️</span>
                <h5 className="text-xl font-bold text-orange-900">Step 1: Karigar's Making Charge</h5>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-800 mb-3">
                  How much making charge will karigar take? (grams)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={makingCharge}
                  onChange={(e) => handleNumberInput(e.target.value, setMakingCharge)}
                  className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                  placeholder="0.012"
                  disabled={isLoading}
                />
                <p className="mt-2 text-sm text-orange-700 bg-orange-100 px-3 py-1 rounded-full inline-block">
                  Maximum: {processData.remainingLoss.toFixed(3)}g
                </p>
              </div>
            </div>

            {/* Step 2: Actual Recovery */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl border-l-4 border-green-500 p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">💰</span>
                <h5 className="text-xl font-bold text-green-900">Step 2: How Much to Recover Now</h5>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-800 mb-3">
                  How much do you want to recover now? (grams)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={actualRecovery}
                  onChange={(e) => handleNumberInput(e.target.value, setActualRecovery)}
                  className="w-full px-4 py-3 text-lg border-2 border-green-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  placeholder="0.400"
                  disabled={isLoading}
                />
                <p className="mt-2 text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full inline-block">
                  Available to recover: {maxRecoverable.toFixed(3)}g (after making charge)
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
              <label className="block text-base font-semibold text-gray-800 mb-3">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                placeholder="e.g. Filing recovery for Hasan bhai"
                disabled={isLoading}
              />
            </div>

            {/* Calculation Summary */}
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border-l-4 border-yellow-500 p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">💡</span>
                <h5 className="text-xl font-bold text-yellow-900">Recovery Summary</h5>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-yellow-200">
                  <span className="text-gray-700 font-medium">Remaining Loss:</span>
                  <span className="text-lg font-bold text-red-600">{processData.remainingLoss.toFixed(3)}g</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-yellow-200">
                  <span className="text-gray-700 font-medium">Making Charge:</span>
                  <span className="text-lg font-bold text-orange-600">{(parseFloat(makingCharge) || 0).toFixed(3)}g</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-yellow-200">
                  <span className="text-gray-700 font-medium">Recovering Now:</span>
                  <span className="text-lg font-bold text-green-600">{(parseFloat(actualRecovery) || 0).toFixed(3)}g</span>
                </div>
                <div className="flex justify-between items-center py-3 bg-purple-100 rounded-lg px-4 border-2 border-purple-300">
                  <span className="text-purple-800 font-bold">Will Still Remain:</span>
                  <span className="text-xl font-black text-purple-700">
                    {Math.max(0, processData.remainingLoss - (parseFloat(makingCharge) || 0) - (parseFloat(actualRecovery) || 0)).toFixed(3)}g
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-center">
                  <span className="text-red-500 text-xl mr-3">⚠️</span>
                  <p className="text-base font-medium text-red-700">{error}</p>
                </div>
              </div>
            )}
            
            {/* Form Submit Button - Hidden but functional */}
            <button
              type="submit"
              style={{ display: 'none' }}
              id="hidden-submit-btn"
            >
              Submit
            </button>
          </form>
        </div>
        
        {/* Bottom Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                console.log('🚀 Record Recovery button clicked!')
                handleSubmit()
              }}
              disabled={isLoading || (!makingCharge && !actualRecovery)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] shadow-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                '💰 Record Recovery'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleLossRecoveryModal
