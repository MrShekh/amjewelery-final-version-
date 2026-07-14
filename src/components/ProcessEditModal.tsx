'use client'

import { useState, useEffect } from 'react'

interface ProcessEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (processId: string, updateData: any) => void
  process: any | null
  isLoading?: boolean
}

const ProcessEditModal: React.FC<ProcessEditModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  process,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    inputWeight: '',
    outputWeight: '',
    // Stone setting specific fields
    adStones: [] as Array<{ sizeMm: number, pieces: number, totalWeight: number }>,
    kalesStones: [] as Array<{ sizeMm: number, pieces: number, totalWeight: number }>,
    // Original input weight (without stones)
    originalInputWeight: ''
  })
  
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && process) {
      console.log('🔧 Setting up edit form for process:', process)
      
      // Calculate original input weight (input - stone weights)
      const adStoneWeight = (process.adStonesAdded || []).reduce((sum: number, stone: any) => 
        sum + (stone.totalWeight || 0), 0)
      const kalesStoneWeight = (process.kalesStonesAdded || []).reduce((sum: number, stone: any) => 
        sum + (stone.totalWeight || 0), 0)
      
      const totalStoneWeight = adStoneWeight + kalesStoneWeight
      const originalInput = (process.inputWeight || 0) - totalStoneWeight
      
      setFormData({
        inputWeight: process.inputWeight?.toString() || '',
        outputWeight: process.outputWeight?.toString() || '',
        adStones: process.adStonesAdded || [],
        kalesStones: process.kalesStonesAdded || [],
        originalInputWeight: Math.max(0, originalInput).toFixed(3)
      })
      setError('')
    }
  }, [isOpen, process])

  const calculateTotalInput = () => {
    const originalWeight = parseFloat(formData.originalInputWeight) || 0
    const adStoneWeight = formData.adStones.reduce((sum, stone) => sum + (stone.totalWeight || 0), 0)
    const kalesStoneWeight = formData.kalesStones.reduce((sum, stone) => sum + (stone.totalWeight || 0), 0)
    return originalWeight + adStoneWeight + kalesStoneWeight
  }

  const handleStoneChange = (type: 'ad' | 'kales', index: number, field: string, value: string) => {
    const stones = type === 'ad' ? [...formData.adStones] : [...formData.kalesStones]
    if (stones[index]) {
      stones[index] = { ...stones[index], [field]: parseFloat(value) || 0 }
      
      // Auto-calculate total weight if pieces and size are provided
      if (field === 'pieces' || field === 'sizeMm') {
        const stone = stones[index]
        if (stone.pieces > 0 && stone.sizeMm > 0) {
          // Simple estimation: weight = pieces * size * 0.001 (adjust as needed)
          stone.totalWeight = stone.pieces * stone.sizeMm * 0.001
        }
      }
      
      if (type === 'ad') {
        setFormData({ ...formData, adStones: stones })
      } else {
        setFormData({ ...formData, kalesStones: stones })
      }
    }
  }

  const addStone = (type: 'ad' | 'kales') => {
    const newStone = { sizeMm: 0, pieces: 0, totalWeight: 0 }
    if (type === 'ad') {
      setFormData({ ...formData, adStones: [...formData.adStones, newStone] })
    } else {
      setFormData({ ...formData, kalesStones: [...formData.kalesStones, newStone] })
    }
  }

  const removeStone = (type: 'ad' | 'kales', index: number) => {
    if (type === 'ad') {
      const stones = formData.adStones.filter((_, i) => i !== index)
      setFormData({ ...formData, adStones: stones })
    } else {
      const stones = formData.kalesStones.filter((_, i) => i !== index)
      setFormData({ ...formData, kalesStones: stones })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const outputWeight = parseFloat(formData.outputWeight) || 0
    const totalInputWeight = calculateTotalInput()
    
    // Basic validation
    if (totalInputWeight <= 0) {
      setError('Input weight must be greater than 0')
      return
    }
    
    if (outputWeight < 0) {
      setError('Output weight cannot be negative')
      return
    }
    
    if (outputWeight > totalInputWeight) {
      setError('Output weight cannot be greater than input weight')
      return
    }

    // Calculate gold loss
    const goldLoss = Math.max(0, totalInputWeight - outputWeight)

    const updateData = {
      inputWeight: totalInputWeight,
      outputWeight: outputWeight,
      goldLoss: goldLoss,
      adStonesAdded: formData.adStones.filter(stone => stone.totalWeight > 0),
      kalesStonesAdded: formData.kalesStones.filter(stone => stone.totalWeight > 0),
      originalInputWeight: parseFloat(formData.originalInputWeight) || 0
    }

    console.log('📤 Submitting process update:', updateData)
    onSubmit(process.id, updateData)
  }

  if (!isOpen) return null

  const totalInput = calculateTotalInput()
  const processTypeName = process?.processType?.replace('_', ' ') || 'Process'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              ✏️ <span>Edit {processTypeName}</span>
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
          {/* Process Info */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
            <h4 className="text-lg font-semibold text-blue-900 mb-2">Process Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <p><strong>Order:</strong> {process?.order?.orderName || 'N/A'}</p>
                <p><strong>Process:</strong> {processTypeName}</p>
              </div>
              <div>
                <p><strong>Sequence:</strong> Step #{process?.sequence || 1}</p>
                <p><strong>Current Input:</strong> {process?.inputWeight?.toFixed(3) || '0.000'}g</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Input/Output */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Input Weight */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                <label className="block text-sm font-semibold text-indigo-900 mb-2">
                  Original Input Weight (without stones)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.originalInputWeight}
                  onChange={(e) => setFormData({ ...formData, originalInputWeight: e.target.value })}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="12.000"
                  disabled={isLoading}
                />
                <p className="text-xs text-indigo-600 mt-1">Base weight before adding stones</p>
              </div>

              {/* Output Weight */}
              <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                <label className="block text-sm font-semibold text-green-900 mb-2">
                  Output Weight (grams)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.outputWeight}
                  onChange={(e) => setFormData({ ...formData, outputWeight: e.target.value })}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="11.500"
                  disabled={isLoading}
                />
                <p className="text-xs text-green-600 mt-1">Final weight after process</p>
              </div>
            </div>

            {/* Stone Setting Fields (only for STONE_SETTING processes) */}
            {process?.processType === 'STONE_SETTING' && (
              <div className="space-y-6">
                {/* AD Stones */}
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-semibold text-purple-900">AD Stones</h4>
                    <button
                      type="button"
                      onClick={() => addStone('ad')}
                      className="bg-purple-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-purple-700"
                      disabled={isLoading}
                    >
                      + Add AD Stone
                    </button>
                  </div>
                  
                  {formData.adStones.map((stone, index) => (
                    <div key={index} className="grid grid-cols-4 gap-3 mb-3 p-3 bg-white rounded-lg border">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Size (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={stone.sizeMm || ''}
                          onChange={(e) => handleStoneChange('ad', index, 'sizeMm', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="2.5"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Pieces</label>
                        <input
                          type="number"
                          value={stone.pieces || ''}
                          onChange={(e) => handleStoneChange('ad', index, 'pieces', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="10"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Weight (g)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={stone.totalWeight || ''}
                          onChange={(e) => handleStoneChange('ad', index, 'totalWeight', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="0.500"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeStone('ad', index)}
                          className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                          disabled={isLoading}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Kales Stones */}
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-semibold text-amber-900">Kales Stones</h4>
                    <button
                      type="button"
                      onClick={() => addStone('kales')}
                      className="bg-amber-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-amber-700"
                      disabled={isLoading}
                    >
                      + Add Kales Stone
                    </button>
                  </div>
                  
                  {formData.kalesStones.map((stone, index) => (
                    <div key={index} className="grid grid-cols-4 gap-3 mb-3 p-3 bg-white rounded-lg border">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Size (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={stone.sizeMm || ''}
                          onChange={(e) => handleStoneChange('kales', index, 'sizeMm', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="3.0"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Pieces</label>
                        <input
                          type="number"
                          value={stone.pieces || ''}
                          onChange={(e) => handleStoneChange('kales', index, 'pieces', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="5"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Weight (g)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={stone.totalWeight || ''}
                          onChange={(e) => handleStoneChange('kales', index, 'totalWeight', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="0.300"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeStone('kales', index)}
                          className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                          disabled={isLoading}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Calculation Summary */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">📊 Calculation Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <p className="font-semibold text-blue-800">Original Input</p>
                  <p className="text-xl font-bold text-blue-600">
                    {parseFloat(formData.originalInputWeight || '0').toFixed(3)}g
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <p className="font-semibold text-purple-800">Stone Weight</p>
                  <p className="text-xl font-bold text-purple-600">
                    {(totalInput - parseFloat(formData.originalInputWeight || '0')).toFixed(3)}g
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <p className="font-semibold text-green-800">Total Input</p>
                  <p className="text-xl font-bold text-green-600">{totalInput.toFixed(3)}g</p>
                </div>
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="font-semibold text-red-800">Loss</p>
                  <p className="text-xl font-bold text-red-600">
                    {Math.max(0, totalInput - (parseFloat(formData.outputWeight) || 0)).toFixed(3)}g
                  </p>
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
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] shadow-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Updating...
                </div>
              ) : (
                '✅ Update Process'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProcessEditModal
