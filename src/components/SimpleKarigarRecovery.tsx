'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { truncateToThreeDecimals, formatToThreeDecimals } from '../utils/numberFormat'
import OrderImage from './OrderImage'

interface Order {
  id: string
  inputWeight: number
  outputWeight: number
  goldLoss: number
  processType: string
  createdAt: string
  goldRecovered?: number
  karigarMakingCharge?: number
  recoveredAt?: string
  goldRecoveredBy?: string
  isFullyRecovered?: boolean
  order: {
    id: string
    orderName: string
    orderNumber?: string
    orderPhoto?: string
    selectedKarat: number
    customer: {
      name: string
      phone?: string
    }
  } | null
}

interface KarigarData {
  id: string
  name: string
  specialty: string
  phone?: string
  processes: Order[]
}

interface RecoveryHistoryItem {
  id: string
  date: string
  karat: string
  totalRecoveryAmount: number
  makingCharge: number
  actualRecoveryAmount: number
  remainingBalance: number
}

const SimpleKarigarRecovery: React.FC<{ karigarId: string }> = ({ karigarId }) => {
  const [loading, setLoading] = useState(true)
  const [karigar, setKarigar] = useState<KarigarData | null>(null)
  const [selectedKarat, setSelectedKarat] = useState<string>('22k')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [makingCharge, setMakingCharge] = useState<number | ''>('')
  const [recoveryAmount, setRecoveryAmount] = useState<number | ''>('')
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchKarigarData = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/karigars/${karigarId}`, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      if (response.ok) {
        const data = await response.json()
        console.log('Karigar API response:', data)
        // The API returns { karigar: ... }, so we need to extract the karigar
        setKarigar(data.karigar || data)
      }
    } catch (error) {
      console.error('Error fetching karigar:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecoveryHistory = async () => {
    try {
      setHistoryLoading(true)
      const response = await fetch(`/api/karigars/${karigarId}/recovery-history`)
      if (response.ok) {
        const data = await response.json()
        const history = (data.recoveryHistory || []) as any[]
        const mapped: RecoveryHistoryItem[] = history.map((item) => ({
          id: item.id,
          date: item.date,
          karat: item.karat || item.karatLabel || '22k',
          totalRecoveryAmount: item.totalRecoveryAmount || 0,
          makingCharge: item.makingCharge || 0,
          actualRecoveryAmount: item.actualRecoveryAmount || 0,
          remainingBalance: item.remainingBalance || 0
        }))
        setRecoveryHistory(mapped)
      } else {
        console.error('Failed to fetch recovery history:', response.status)
      }
    } catch (error) {
      console.error('Error fetching recovery history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Load karigar data and recovery history when the component mounts or karigarId changes
  useEffect(() => {
    fetchKarigarData()
    fetchRecoveryHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karigarId])

  const getKaratValue = (karat: string): number => {
    switch(karat) {
      case '22k': return 92
      case '21.1k': return 88
      case '20k': return 84
      case '19.2k': return 80
      case '18.2k': return 76
      case '18k': return 75.5
      case '18k-alt': return 75
      case '14.2k': return 59
      case '9k': return 37.5
      default: return 92
    }
  }


  // Get active (non-recovered) orders for selected karat - SIMPLE FLAG-BASED APPROACH
  const getActiveOrders = (): Order[] => {
    if (!karigar || !karigar.processes || !Array.isArray(karigar.processes)) return []

    return karigar.processes.filter((order: any) => {
      return (
        order.order?.selectedKarat === getKaratValue(selectedKarat) &&
        !order.isFullyRecovered
      )
    })
  }

  // Get orders by date (for history)
  const getOrdersByDate = (): Order[] => {
    if (!karigar || !karigar.processes || !selectedDate) return []
    
    return karigar.processes.filter((order: any) => {
      const orderDate = new Date(order.createdAt).toDateString()
      const filterDate = new Date(selectedDate).toDateString()
      return orderDate === filterDate && order.order?.selectedKarat === getKaratValue(selectedKarat)
    })
  }

  const activeOrders = getActiveOrders()
  const displayOrders = activeOrders

  // Calculate totals
  const totalInput = truncateToThreeDecimals(displayOrders.reduce((sum, order) => sum + (order.inputWeight || 0), 0))
  const totalOutput = truncateToThreeDecimals(displayOrders.reduce((sum, order) => sum + (order.outputWeight || 0), 0))
  const totalLoss = truncateToThreeDecimals(displayOrders.reduce((sum, order) => sum + (order.goldLoss || 0), 0))
  const makingChargeValue = typeof makingCharge === 'number' ? truncateToThreeDecimals(makingCharge) : 0
  const netLoss = truncateToThreeDecimals(Math.max(0, totalLoss - makingChargeValue))

  const handleRecovery = async () => {
    if (displayOrders.length === 0) {
      alert('No orders to recover')
      return
    }

    const makingChargeNum = truncateToThreeDecimals(typeof makingCharge === 'number' ? makingCharge : parseFloat(makingCharge as string) || 0)
    const recoveryAmountNum = truncateToThreeDecimals(typeof recoveryAmount === 'number' ? recoveryAmount : parseFloat(recoveryAmount as string) || 0)
    
    console.log('🔍 Recovery validation (simple):', {
      totalLoss,
      makingChargeNum,
      recoveryAmountNum,
      makingChargeType: typeof makingCharge
    })
    
    if (makingChargeNum < 0) {
      alert('Making charge cannot be negative')
      return
    }
    if (recoveryAmountNum < 0) {
      alert('Recovery amount cannot be negative')
      return
    }
    // Allow recovery amount to be less than (totalLoss - makingChargeNum), but not sum to be greater than totalLoss (with small tolerance)
    if (makingChargeNum + recoveryAmountNum > totalLoss + 0.005) {
      alert(`Sum of making charge (${formatToThreeDecimals(makingChargeNum)}g) and recovery amount (${formatToThreeDecimals(recoveryAmountNum)}g) cannot exceed total loss (${formatToThreeDecimals(totalLoss)}g)`)
      return
    }

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const requestBody = {
        orderIds: displayOrders.map(o => o.id),
        karat: selectedKarat,
        makingCharge: makingChargeNum,
        recoveredAmount: recoveryAmountNum,
        totalLoss,
        selectedDate: selectedDate || null
      }

      
      console.log('🚀 API Request:', {
        url: `/api/karigars/${karigarId}/new-simple-recovery`,
        body: requestBody
      })
      
      const response = await fetch(`/api/karigars/${karigarId}/new-simple-recovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(requestBody)
      })
      
      console.log('🔄 API Response status:', response.status)

      if (response.ok) {
        const dateInfo = selectedDate
          ? `\nRecovery Date: ${new Date(selectedDate).toLocaleDateString()}`
          : ''
        alert(`Recovery completed successfully!${dateInfo}\n\nKarat: ${selectedKarat}\nOrders: ${displayOrders.length}\nTotal Loss: ${formatToThreeDecimals(totalLoss)}g\nMaking Charge: ${formatToThreeDecimals(makingChargeNum)}g (Karigar keeps)\nRecovered from karigar loss: ${formatToThreeDecimals(recoveryAmountNum)}g`)
        
        setShowRecoveryModal(false)
        setMakingCharge('')
        setRecoveryAmount('')
        // Reload karigar data so list becomes empty when fully recovered
        fetchKarigarData()
      } else {
        const error = await response.json()
        console.error('Recovery API error:', error)
        alert(error.error || error.message || 'Recovery failed')
      }
    } catch (error) {
      console.error('Recovery error:', error)
      alert('Recovery failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!karigar) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Karigar not found</h2>
        <Link href="/karigars" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
          Back to Karigars
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/karigars" className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{karigar.name}</h1>
              <p className="text-gray-600">Simple Loss Recovery</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Specialty: {karigar.specialty || 'General'}</p>
            <p className="text-sm text-gray-600">Phone: {karigar.phone || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">🔍 Recovery Filters & History</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Karat Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Karat Type
            </label>
            <select
              value={selectedKarat}
              onChange={(e) => setSelectedKarat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="22k">22k (92%)</option>
              <option value="21.1k">21.1k (88%)</option>
              <option value="20k">20k (84%)</option>
              <option value="19.2k">19.2k (80%)</option>
              <option value="18.2k">18.2k (76%)</option>
              <option value="18k">18k (75.5%)</option>
              <option value="18k-alt">18k (75%)</option>
              <option value="14.2k">14.2k (59%)</option>
              <option value="9k">9k (37.5%)</option>
            </select>
          </div>
          
          {/* Recovery Date Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recovery Date (for history filter & record)
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              This date will be stored with the recovery entry for reference only.
            </p>
          </div>
        </div>
      </div>

      {/* Orders Summary */}
      {displayOrders.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">
            📊 {selectedKarat} Orders Summary {selectedDate && `(${new Date(selectedDate).toLocaleDateString()})`}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">{displayOrders.length}</p>
              <p className="text-sm text-gray-600">Orders</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">{formatToThreeDecimals(totalInput)}g</p>
              <p className="text-sm text-gray-600">Total Input</p>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-orange-600">{formatToThreeDecimals(totalOutput)}g</p>
              <p className="text-sm text-gray-600">Total Output</p>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{formatToThreeDecimals(totalLoss)}g</p>
              <p className="text-sm text-gray-600">Total Loss</p>
            </div>
          </div>

      {/* Recovery Section - For both active orders and date-specific orders */}
          {displayOrders.length > 0 && (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium">
                  💰 Recovery Process
                  {selectedDate && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      (Date: {new Date(selectedDate).toLocaleDateString()})
                    </span>
                  )}
                </h4>
                <button
                  onClick={() => {
                    // Default behaviour: recover full available loss for shown orders
                    setMakingCharge('')
                    setRecoveryAmount(netLoss)
                    setShowRecoveryModal(true)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                >
                  {selectedDate ? 'Recover Date Loss' : 'Start Recovery'}
                </button>
              </div>
              
              {/* Current recovery calculated totals */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-xl font-bold text-gray-800">{formatToThreeDecimals(totalLoss)}g</p>
                  <p className="text-sm text-gray-600">Total Loss</p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <p className="text-xl font-bold text-yellow-600">{formatToThreeDecimals(makingChargeValue)}g</p>
                  <p className="text-sm text-gray-600">Making Charge</p>
                  <p className="text-xs text-gray-500">Karigar keeps</p>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-xl font-bold text-purple-600">{formatToThreeDecimals(netLoss)}g</p>
                  <p className="text-sm text-gray-600">Available to Recover</p>
                  <p className="text-xs text-gray-500">Admin can take</p>
                </div>
              </div>
              
            </div>
          )}
        </div>
      )}

      {/* Orders List */}
      {displayOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">📋 Order Details</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Process</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Input</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Output</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayOrders.map((order, index) => (
                  <tr key={order.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="w-16 h-16">
                        <OrderImage 
                          src={order.order?.orderPhoto}
                          alt={order.order?.orderName || 'Order'}
                          orderName={order.order?.orderName || 'N/A'}
                          className="w-full h-full object-cover rounded-lg border border-gray-200 hover:scale-105 transition-transform duration-300"
                          fallbackClassName="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.order?.orderName || 'N/A'}</div>
                      <div className="text-sm text-gray-500">#{order.order?.orderNumber || order.id.slice(-8)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.order?.customer?.name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{order.order?.customer?.phone || ''}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {order.processType.replace('_', ' ')}
                        </span>
                        
                        {/* Show stone pieces for STONE_SETTING processes */}
                        {order.processType === 'STONE_SETTING' && (() => {
                          const orderAny = order as any
                          const adStonePieces = (orderAny.adStonesAdded || []).reduce((sum: number, stone: any) => 
                            sum + (stone.pieces || 0), 0)
                          const kalesStonePieces = (orderAny.kalesStonesAdded || []).reduce((sum: number, stone: any) => 
                            sum + (stone.pieces || 0), 0)
                          const totalPieces = adStonePieces + kalesStonePieces
                          
                          if (totalPieces > 0) {
                            return (
                              <div className="text-xs font-medium mt-2">
                                <div className="flex items-center space-x-1 mb-1">
                                  <span className="text-purple-600">💎</span>
                                  <span className="text-purple-700">{totalPieces} pieces total</span>
                                </div>
                                <div className="text-xs text-gray-500 space-y-1">
                                  {adStonePieces > 0 && (
                                    <div className="flex justify-between">
                                      <span>AD:</span>
                                      <span className="font-medium">{adStonePieces} pcs</span>
                                    </div>
                                  )}
                                  {kalesStonePieces > 0 && (
                                    <div className="flex justify-between">
                                      <span>Kales:</span>
                                      <span className="font-medium">{kalesStonePieces} pcs</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                      {formatToThreeDecimals(order.inputWeight)}g
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {formatToThreeDecimals(order.outputWeight)}g
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {formatToThreeDecimals(order.goldLoss)}g
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {(() => {
                        const isRecovered = !!order.isFullyRecovered
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isRecovered 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {isRecovered ? 'Recovered' : 'Pending'}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Recovery Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full m-4">
            <h3 className="text-lg font-semibold mb-4">
              💰 Recover {selectedKarat} Loss
              {selectedDate && (
                <span className="text-sm font-normal text-gray-600 block">
                  Date: {new Date(selectedDate).toLocaleDateString()}
                </span>
              )}
            </h3>
            
              <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Orders to recover: {displayOrders.length}</p>
                <p className="text-sm text-gray-600">Total loss: {formatToThreeDecimals(totalLoss)}g</p>
                {selectedDate && (
                  <p className="text-sm text-blue-600 font-medium">Recovery for specific date orders</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Making Charge (Karigar keeps)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={makingCharge}
                  onChange={(e) => {
                    const val = e.target.value === ''
                      ? ''
                      : truncateToThreeDecimals(parseFloat(e.target.value) || 0)
                    setMakingCharge(val)
                    if (val === '') {
                      setRecoveryAmount('')
                    } else {
                      const numVal = typeof val === 'number' ? val : parseFloat(val as any) || 0
                      const computedRecovery = truncateToThreeDecimals(Math.max(0, totalLoss - numVal))
                      setRecoveryAmount(computedRecovery)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter making charge in grams"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recovery Amount (Admin recovers)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={recoveryAmount}
                  onChange={(e) => {
                    setRecoveryAmount(e.target.value === '' ? '' : truncateToThreeDecimals(parseFloat(e.target.value) || 0))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter recovery amount"
                />
                <p className="text-xs text-gray-500 mt-1">Initially set to (Total Loss - Making Charge), but you can edit to the actual returned weight.</p>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleRecovery}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold"
              >
                Complete Recovery
              </button>
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recovery History (compact summary) */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">📈 Recovery Summary</h3>
        {historyLoading ? (
          <p className="text-gray-500 text-sm">Loading history...</p>
        ) : recoveryHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">No recovery recorded yet for this karigar.</p>
        ) : (() => {
          const filteredHistory = recoveryHistory.filter((record) => {
            const karatMatches = (record.karat || '22k') === selectedKarat
            let dateMatches = true
            if (selectedDate) {
              const recDate = new Date(record.date)
              const recKey = recDate.toISOString().slice(0, 10)
              dateMatches = recKey === selectedDate
            }
            return karatMatches && dateMatches
          })

          if (filteredHistory.length === 0) {
            return (
              <p className="text-gray-500 text-sm">
                No recovery recorded for {selectedKarat} {selectedDate && `on ${new Date(selectedDate).toLocaleDateString()}`}.
              </p>
            )
          }

          // Aggregate simple totals for the selected karat (and date if chosen)
          const totalMaking = truncateToThreeDecimals(
            filteredHistory.reduce((sum, record) => sum + (record.makingCharge || 0), 0)
          )
          const totalRecovered = truncateToThreeDecimals(
            filteredHistory.reduce((sum, record) => sum + (record.actualRecoveryAmount || 0), 0)
          )
          const totalLoss = truncateToThreeDecimals(
            filteredHistory.reduce((sum, record) => {
              const making = record.makingCharge || 0
              const recovered = record.actualRecoveryAmount || 0
              const remaining = record.remainingBalance || 0
              return sum + making + recovered + remaining
            }, 0)
          )

          return (
            <div className="space-y-2 text-sm">
              <p className="text-gray-700 font-medium">
                Karat: <span className="font-semibold">{selectedKarat}</span>
                {selectedDate && (
                  <span className="ml-2 text-gray-500">
                    Date: {new Date(selectedDate).toLocaleDateString()}
                  </span>
                )}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Loss</p>
                  <p className="text-lg font-bold text-gray-900">{formatToThreeDecimals(totalLoss)} g</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <p className="text-xs text-gray-500 mb-1">Making Charge (Karigar)</p>
                  <p className="text-lg font-bold text-yellow-700">{formatToThreeDecimals(totalMaking)} g</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-xs text-gray-500 mb-1">Recovered (Admin)</p>
                  <p className="text-lg font-bold text-green-700">{formatToThreeDecimals(totalRecovered)} g</p>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default SimpleKarigarRecovery
