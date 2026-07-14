'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  fineToKarat, 
  karatToFine, 
  calculateCastingProcess, 
  formatGoldWeight,
  getPurityDisplayName,
  KARAT_PURITY_VALUES,
  KaratPurity,
  CastingCalculation 
} from '@/lib/gold-conversions'

interface Inventory {
  adminStock: number
  karigarStock: number
  customerStock: number
}

interface CastingRecord {
  id: string
  initialGoldTaken: number
  extraGoldCut: number
  finalCastingWeight: number
  castingLoss: number
  finalCastGold: number
  adminStockBefore: number
  adminStockAfter: number
  karigarStockBefore: number
  karigarStockAfter: number
  description: string
  createdAt: string
}

interface KaratCastingRecord {
  id: string
  fineGoldTaken: number
  selectedPurity: KaratPurity
  maxKaratGoldPossible: number
  actualKaratGoldCast: number
  remainingKaratGold: number
  fineGoldReturnedToAdmin: number
  adminStockBefore: number
  adminStockAfter: number
  description: string
  createdAt: string
}

const CastingPage = () => {
  const router = useRouter()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [karatCastingRecords, setKaratCastingRecords] = useState<KaratCastingRecord[]>([])
  const [loading, setLoading] = useState(false)
  
  // New karat conversion form data
  const [karatFormData, setKaratFormData] = useState({
    fineGoldTaken: '',
    selectedPurity: 92 as KaratPurity,
    actualCastingDone: '',
    description: ''
  })
  const [showConversionPreview, setShowConversionPreview] = useState(false)
  const [castingCalculation, setCastingCalculation] = useState<CastingCalculation | null>(null)

  useEffect(() => {
    fetchInventory()
    fetchCastingRecords()
  }, [])

  const fetchInventory = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/inventory', {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      
      if (!response.ok) {
        console.error('Inventory fetch failed:', response.status)
        return
      }
      
      const data = await response.json()
      // Handle new API response format
      if (data.success) {
        setInventory(data.data.inventory)
      } else {
        setInventory(data.inventory) // Fallback for old format
      }
    } catch (error) {
      console.error('Error fetching inventory:', error)
    }
  }

  const fetchCastingRecords = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/casting/karat', {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      
      if (!response.ok) {
        console.error('Karat casting records fetch failed:', response.status)
        return
      }
      
      const data = await response.json()
      setKaratCastingRecords(data.karatCastings || [])
    } catch (error) {
      console.error('Error fetching karat casting records:', error)
    }
  }

  // Karat conversion calculations
  useEffect(() => {
    const fineGold = parseFloat(karatFormData.fineGoldTaken) || 0
    const actualCasting = parseFloat(karatFormData.actualCastingDone) || 0
    
    if (fineGold > 0 && actualCasting >= 0) {
      const calculation = calculateCastingProcess(
        fineGold,
        karatFormData.selectedPurity,
        actualCasting
      )
      setCastingCalculation(calculation)
      setShowConversionPreview(true)
    } else {
      setCastingCalculation(null)
      setShowConversionPreview(false)
    }
  }, [karatFormData.fineGoldTaken, karatFormData.selectedPurity, karatFormData.actualCastingDone])

  const handleKaratCastingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inventory) {
      alert('Inventory data not available')
      return
    }

    if (!castingCalculation) {
      alert('Please enter casting details')
      return
    }

    const fineGoldTaken = parseFloat(karatFormData.fineGoldTaken)
    
    if (fineGoldTaken > inventory.adminStock) {
      alert('Insufficient admin stock for this operation')
      return
    }

    if (castingCalculation.actualKaratGoldCast > castingCalculation.maxKaratGoldPossible) {
      alert('Actual casting amount cannot exceed maximum possible karat gold')
      return
    }

    setLoading(true)

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/casting/karat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          fineGoldTaken,
          selectedPurity: karatFormData.selectedPurity,
          actualKaratGoldCast: castingCalculation.actualKaratGoldCast,
          fineGoldReturnedToAdmin: castingCalculation.fineGoldReturnedToAdmin,
          description: karatFormData.description
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert('Karat casting process completed successfully!')
        
        // Reset form
        setKaratFormData({
          fineGoldTaken: '',
          selectedPurity: 92 as KaratPurity,
          actualCastingDone: '',
          description: ''
        })
        setCastingCalculation(null)
        setShowConversionPreview(false)
        
        // Refresh data
        fetchInventory()
        fetchCastingRecords()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to complete casting process')
      }
    } catch (error) {
      console.error('Error completing casting:', error)
      alert('Failed to complete casting process')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Casting Management</h1>
        <p className="mt-2 text-gray-600">
          Manage gold casting process and track stock movements
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Casting Form */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">New Casting Process</h2>
          
          {/* Current Stock Display */}
          {inventory && (
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Current Stock</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Admin Stock:</span>
                  <div className="font-medium">{inventory.adminStock.toFixed(3)}g</div>
                </div>
                <div>
                  <span className="text-gray-600">Karigar Stock:</span>
                  <div className="font-medium">{inventory.karigarStock.toFixed(3)}g</div>
                </div>
                <div>
                  <span className="text-gray-600">Customer Stock:</span>
                  <div className="font-medium">{inventory.customerStock.toFixed(3)}g</div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleKaratCastingSubmit} className="space-y-6">
            {/* Fine Gold Taken */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fine Gold Taken from Admin Stock * (grams)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={karatFormData.fineGoldTaken}
                onChange={(e) => setKaratFormData({ ...karatFormData, fineGoldTaken: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 100"
              />
              <p className="mt-1 text-sm text-gray-500">
                Fine 24k gold taken from admin stock for casting
              </p>
            </div>

            {/* Purity Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Karat Purity *
              </label>
              <select
                value={karatFormData.selectedPurity}
                onChange={(e) => setKaratFormData({ ...karatFormData, selectedPurity: parseFloat(e.target.value) as KaratPurity })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {KARAT_PURITY_VALUES.map(purity => (
                  <option key={purity} value={purity}>
                    {getPurityDisplayName(purity)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Target karat purity for casting
              </p>
            </div>

            {/* Actual Casting Done */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actual Karat Gold Cast * (grams)
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                required
                value={karatFormData.actualCastingDone}
                onChange={(e) => setKaratFormData({ ...karatFormData, actualCastingDone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 70"
              />
              <p className="mt-1 text-sm text-gray-500">
                Actual {getPurityDisplayName(karatFormData.selectedPurity)} gold cast and sent to Karigar
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={karatFormData.description}
                onChange={(e) => setKaratFormData({ ...karatFormData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Notes about this casting process..."
              />
            </div>

            {/* Karat Conversion Preview */}
            {showConversionPreview && castingCalculation && (
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Karat Conversion Calculations</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Fine Gold Taken:</span>
                    <span className="font-medium">{formatGoldWeight(castingCalculation.fineGoldTaken)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Purity:</span>
                    <span className="font-medium">{getPurityDisplayName(karatFormData.selectedPurity)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maximum Karat Gold Possible:</span>
                    <span className="font-medium">{formatGoldWeight(castingCalculation.maxKaratGoldPossible)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual Karat Gold Cast:</span>
                    <span className="font-medium text-blue-600">{formatGoldWeight(castingCalculation.actualKaratGoldCast)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Karat Gold:</span>
                    <span className="font-medium text-orange-600">{formatGoldWeight(castingCalculation.remainingKaratGold)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Fine Gold Returned to Admin:</span>
                    <span className="text-green-600">{formatGoldWeight(castingCalculation.fineGoldReturnedToAdmin)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Stock Changes Preview */}
            {inventory && showConversionPreview && castingCalculation && (
              <div className="bg-yellow-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Stock Changes Preview</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Admin Fine Stock:</span>
                    <span className="font-medium">
                      {formatGoldWeight(inventory.adminStock)} → 
                      {formatGoldWeight(inventory.adminStock - castingCalculation.fineGoldTaken + castingCalculation.fineGoldReturnedToAdmin)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Karigar {getPurityDisplayName(karatFormData.selectedPurity)} Stock:</span>
                    <span className="font-medium text-green-600">
                      +{formatGoldWeight(castingCalculation.actualKaratGoldCast)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={loading || !inventory || !castingCalculation || !showConversionPreview}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-6 py-2 rounded-md font-medium"
              >
                {loading ? 'Processing...' : 'Complete Karat Casting'}
              </button>
              <Link 
                href="/orders/new?fromCasting=true"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
              >
                Create Orders from Cast Gold
              </Link>
            </div>
          </form>
        </div>

        {/* Recent Karat Casting History */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Karat Casting History</h2>
          
          {karatCastingRecords.length === 0 ? (
            <p className="text-gray-500">No karat casting records yet</p>
          ) : (
            <div className="space-y-4">
              {karatCastingRecords.slice(0, 5).map((record) => (
                <div key={record.id} className="border border-gray-200 rounded-md p-4">
                  {/* Header with Date and Purity */}
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-900">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-blue-600">
                      {getPurityDisplayName(record.selectedPurity)}
                    </div>
                  </div>
                  
                  {/* Main Casting Data */}
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Fine Gold Taken:</span>
                      <div className="font-medium text-red-600">
                        -{formatGoldWeight(record.fineGoldTaken)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Karat Gold Cast:</span>
                      <div className="font-medium text-green-600">
                        {formatGoldWeight(record.actualKaratGoldCast)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Fine Gold Returned:</span>
                      <div className="font-medium text-green-600">
                        +{formatGoldWeight(record.fineGoldReturnedToAdmin)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Max Possible:</span>
                      <div className="font-medium">
                        {formatGoldWeight(record.maxKaratGoldPossible)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stock Changes Summary */}
                  <div className="bg-gray-50 p-2 rounded text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Admin Stock:</span>
                      <span className="font-medium">
                        {formatGoldWeight(record.adminStockBefore)} → {formatGoldWeight(record.adminStockAfter)}
                      </span>
                    </div>
                  </div>
                  
                  {record.description && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Note:</span> {record.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CastingPage
