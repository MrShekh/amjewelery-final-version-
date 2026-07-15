'use client'

import { useEffect, useState } from 'react'

interface InventoryData {
  inventory: {
    customerStock: number
    karigarLossStock?: number
    recoveredStock?: number
  }
  summary: {
    customerStock: number
    karigarLossStock?: number
    recoveredStock?: number
  }
  recentTransactions: Array<{
    id: string
    type: string
    amount: number
    description: string
    createdAt: string
    order?: {
      customer: {
        name: string
      }
    }
  }>
}

const Dashboard = () => {
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)

  // Manual making charge stock state (day / month)
  const [manualMakingMode, setManualMakingMode] = useState<'day' | 'month'>('day')
  const [manualMakingDate, setManualMakingDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [manualMakingMonth, setManualMakingMonth] = useState<string>(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}` // YYYY-MM
  })
  const [manualMakingTotal, setManualMakingTotal] = useState<number>(0)
  const [manualMakingLoading, setManualMakingLoading] = useState<boolean>(false)

  // Recovered stock state (day / month)
  const [recoveredMode, setRecoveredMode] = useState<'day' | 'month'>('day')
  const [recoveredDate, setRecoveredDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [recoveredMonth, setRecoveredMonth] = useState<string>(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}` // YYYY-MM
  })
  const [recoveredTotal, setRecoveredTotal] = useState<number>(0)
  const [recoveredLoading, setRecoveredLoading] = useState<boolean>(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionToken = localStorage.getItem('sessionToken')
        const inventoryRes = await fetch('/api/inventory', {
          headers: {
            'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
          }
        })

        if (inventoryRes.ok) {
          const inventory = await inventoryRes.json()
          // Handle new API response format
          if (inventory.success) {
            setInventoryData(inventory.data)
          } else {
            setInventoryData(inventory) // Fallback for old format
          }
        } else {
          console.error('Failed to fetch inventory for dashboard')
        }
      } catch (error) {
        console.error('Error fetching inventory for dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Fetch manual making charge total whenever filter changes
  useEffect(() => {
    const fetchManualMakingCharge = async () => {
      try {
        setManualMakingLoading(true)
        const sessionToken = localStorage.getItem('sessionToken')
        const params = new URLSearchParams()

        if (manualMakingMode === 'day') {
          params.set('date', manualMakingDate)
        } else {
          params.set('month', manualMakingMonth)
        }

        const res = await fetch(`/api/reports/manual-making-charge?${params.toString()}`, {
          headers: {
            'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
          }
        })

        if (res.ok) {
          const data = await res.json()
          const payload = data.success ? data.data : data
          setManualMakingTotal(payload.totalManualMakingChargeGrams || 0)
        } else {
          console.error('Failed to fetch manual making charge report')
          setManualMakingTotal(0)
        }
      } catch (error) {
        console.error('Error fetching manual making charge report:', error)
        setManualMakingTotal(0)
      } finally {
        setManualMakingLoading(false)
      }
    }

    fetchManualMakingCharge()
  }, [manualMakingMode, manualMakingDate, manualMakingMonth])

  // Fetch recovered stock total whenever filter changes
  useEffect(() => {
    const fetchRecoveredStock = async () => {
      try {
        setRecoveredLoading(true)
        const sessionToken = localStorage.getItem('sessionToken')
        const params = new URLSearchParams()

        if (recoveredMode === 'day') {
          params.set('date', recoveredDate)
        } else {
          params.set('month', recoveredMonth)
        }

        const res = await fetch(`/api/reports/recovered-stock?${params.toString()}`, {
          headers: {
            'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
          }
        })

        if (res.ok) {
          const data = await res.json()
          const payload = data.success ? data.data : data
          setRecoveredTotal(payload.totalRecovered || 0)
        } else {
          console.error('Failed to fetch recovered stock report')
          setRecoveredTotal(0)
        }
      } catch (error) {
        console.error('Error fetching recovered stock report:', error)
        setRecoveredTotal(0)
      } finally {
        setRecoveredLoading(false)
      }
    }

    fetchRecoveredStock()
  }, [recoveredMode, recoveredDate, recoveredMonth])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Simple stock overview</p>
        </div>
      </div>

      {/* Stock Summary - Karigar Loss, Customer Stock, Recovered Stock, Manual Making Charge */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-400 to-blue-600 p-6 rounded-lg text-white">
          <h3 className="text-sm font-medium text-blue-100 uppercase tracking-wide">
            Karigar Total Loss
          </h3>
          <p className="mt-2 text-3xl font-bold">
            {(inventoryData?.inventory.karigarLossStock ?? inventoryData?.summary.karigarLossStock ?? 0).toFixed(3)}g
          </p>
          <p className="text-xs text-blue-100 mt-1">Total loss accumulated (Filing In - Finish Weight)</p>
        </div>

        <div className="bg-gradient-to-r from-orange-400 to-red-500 p-6 rounded-lg text-white">
          <h3 className="text-sm font-medium text-orange-100 uppercase tracking-wide">
            Customer Stock
          </h3>
          <p className="mt-2 text-3xl font-bold">
            {inventoryData?.inventory.customerStock?.toFixed(2) || inventoryData?.summary.customerStock?.toFixed(2) || '0.00'}g
          </p>
          <p className="text-xs text-orange-100 mt-1">Customer gold balance (simple)</p>
        </div>

        {/* Recovered Stock (Day / Month) */}
        <div className="bg-gradient-to-r from-green-400 to-emerald-600 p-6 rounded-lg text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium text-green-100 uppercase tracking-wide">
                  Recovered Stock
                </h3>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
                  {recoveredMode === 'day' ? 'Daily' : 'Monthly'}
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold">
                {recoveredLoading ? '...' : `${recoveredTotal.toFixed(2)}g`}
              </p>
              <p className="text-xs text-green-100 mt-1">
                {recoveredMode === 'day'
                  ? `Total recovered on ${new Date(recoveredDate).toLocaleDateString('en-IN')}`
                  : (() => {
                    const safeMonth = recoveredMonth || new Date().toISOString().slice(0, 7)
                    const d = new Date(safeMonth + '-01')
                    return `Total recovered in ${d.toLocaleString('en-IN', {
                      month: 'long',
                      year: 'numeric'
                    })}`
                  })()}
              </p>
            </div>
            <div className="ml-4 flex flex-col items-end space-y-2">
              <div className="flex space-x-1 text-[10px] bg-white/10 rounded-full p-0.5">
                <button
                  type="button"
                  onClick={() => setRecoveredMode('day')}
                  className={`px-2 py-0.5 rounded-full ${recoveredMode === 'day' ? 'bg-white text-emerald-700' : 'text-emerald-100'
                    }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveredMode('month')}
                  className={`px-2 py-0.5 rounded-full ${recoveredMode === 'month' ? 'bg-white text-emerald-700' : 'text-emerald-100'
                    }`}
                >
                  Month
                </button>
              </div>

              {recoveredMode === 'day' ? (
                <div>
                  <label className="block text-[10px] font-medium text-green-100 mb-1">Date</label>
                  <input
                    type="date"
                    value={recoveredDate}
                    onChange={(e) => setRecoveredDate(e.target.value)}
                    className="px-2 py-1 rounded bg-white/10 text-xs text-white border border-green-200 focus:outline-none focus:ring-1 focus:ring-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-medium text-green-100 mb-1">Month</label>
                  <input
                    type="month"
                    value={recoveredMonth}
                    onChange={(e) => setRecoveredMonth(e.target.value)}
                    className="px-2 py-1 rounded bg-white/10 text-xs text-white border border-green-200 focus:outline-none focus:ring-1 focus:ring-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual Making Charge Stock (Day / Month) */}
        <div className="bg-gradient-to-r from-indigo-400 to-indigo-600 p-6 rounded-lg text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium text-indigo-100 uppercase tracking-wide">
                  Manual Making Charge
                </h3>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
                  {manualMakingMode === 'day' ? 'Daily' : 'Monthly'}
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold">
                {manualMakingLoading ? '...' : `${manualMakingTotal.toFixed(2)}g`}
              </p>
              <p className="text-xs text-indigo-100 mt-1">
                {manualMakingMode === 'day'
                  ? `Total manual making charge for ${new Date(manualMakingDate).toLocaleDateString('en-IN')}`
                  : (() => {
                    const safeMonth = manualMakingMonth || new Date().toISOString().slice(0, 7)
                    const d = new Date(safeMonth + '-01')
                    return `Total manual making charge for ${d.toLocaleString('en-IN', {
                      month: 'long',
                      year: 'numeric'
                    })}`
                  })()}
              </p>
            </div>
            <div className="ml-4 flex flex-col items-end space-y-2">
              <div className="flex space-x-1 text-[10px] bg-white/10 rounded-full p-0.5">
                <button
                  type="button"
                  onClick={() => setManualMakingMode('day')}
                  className={`px-2 py-0.5 rounded-full ${manualMakingMode === 'day' ? 'bg-white text-indigo-700' : 'text-indigo-100'
                    }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => setManualMakingMode('month')}
                  className={`px-2 py-0.5 rounded-full ${manualMakingMode === 'month' ? 'bg-white text-indigo-700' : 'text-indigo-100'
                    }`}
                >
                  Month
                </button>
              </div>

              {manualMakingMode === 'day' ? (
                <div>
                  <label className="block text-[10px] font-medium text-indigo-100 mb-1">Date</label>
                  <input
                    type="date"
                    value={manualMakingDate}
                    onChange={(e) => setManualMakingDate(e.target.value)}
                    className="px-2 py-1 rounded bg-white/10 text-xs text-white border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-medium text-indigo-100 mb-1">Month</label>
                  <input
                    type="month"
                    value={manualMakingMonth}
                    onChange={(e) => setManualMakingMonth(e.target.value)}
                    className="px-2 py-1 rounded bg-white/10 text-xs text-white border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* All other dashboard analytics removed for simplified model */}
    </div>
  )
}

export default Dashboard
