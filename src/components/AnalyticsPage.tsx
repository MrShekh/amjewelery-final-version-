'use client'

import { useState, useEffect, useCallback } from 'react'
import { Scale, Calendar, Filter, Hammer } from 'lucide-react'

interface Totals {
  fillingIn?: number
}

type KaratKarigarIn = Record<string, Record<string, number>>

const KARAT_OPTIONS = [
  { label: 'All Karats', value: 'all' },
  { label: '22k (92%)', value: '92' },
  { label: '18k (75.5%)', value: '75.5' },
  { label: '19.2k (80%)', value: '80' },
  { label: '21k (88%)', value: '88' },
  { label: '14k (59%)', value: '59' },
  { label: '9k (37.5%)', value: '37.5' },
]

export default function AnalyticsPage() {
  const [todayFillingIn, setTodayFillingIn] = useState(0)
  const [monthFillingIn, setMonthFillingIn] = useState(0)
  const [filteredTotalFillingIn, setFilteredTotalFillingIn] = useState(0)
  const [fillingKarigarIn, setFillingKarigarIn] = useState<KaratKarigarIn>({})
  const [dateFilter, setDateFilter] = useState('all')
  const [karatFilter, setKaratFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      // Fetch today, month, and filtered data in parallel
      const [todayRes, monthRes, filteredRes] = await Promise.all([
        fetch(`/api/orders?dateFilter=today&limit=1`, {
          headers: { 'Authorization': sessionToken ? `Bearer ${sessionToken}` : '' }
        }),
        fetch(`/api/orders?dateFilter=month&limit=1`, {
          headers: { 'Authorization': sessionToken ? `Bearer ${sessionToken}` : '' }
        }),
        fetch(`/api/orders?dateFilter=${dateFilter}&karatFilter=${karatFilter}&limit=1`, {
          headers: { 'Authorization': sessionToken ? `Bearer ${sessionToken}` : '' }
        })
      ])

      const todayData = await todayRes.json()
      const monthData = await monthRes.json()
      const filteredData = await filteredRes.json()

      if (todayData.success) {
        setTodayFillingIn(todayData.data?.totals?.fillingIn || 0)
      }
      if (monthData.success) {
        setMonthFillingIn(monthData.data?.totals?.fillingIn || 0)
      }
      if (filteredData.success) {
        setFilteredTotalFillingIn(filteredData.data?.totals?.fillingIn || 0)
        setFillingKarigarIn(filteredData.data?.fillingKarigarIn || {})
      }
    } catch (err) {
      console.error('Failed to load analytics', err)
    } finally {
      setLoading(false)
    }
  }, [dateFilter, karatFilter])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const renderKarigarCard = (
    title: string,
    icon: React.ReactNode,
    data: KaratKarigarIn
  ) => {
    const karatKeys = Object.keys(data)
    const hasData = karatKeys.some(k => Object.keys(data[k]).length > 0)

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
        <div className="flex items-center gap-2 pb-3.5 mb-3.5 border-b border-gray-100">
          {icon}
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">{title}</h3>
        </div>
        {hasData ? (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
            {karatKeys.sort().map((karatLabel) => {
              const karigarEntries = Object.entries(data[karatLabel])
              if (karigarEntries.length === 0) return null

              // Calculate subtotal for this karat
              const karatSubtotal = karigarEntries.reduce((sum, [, val]) => sum + val, 0)

              return (
                <div key={karatLabel} className="space-y-2">
                  {/* Karat header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {karatLabel}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded text-blue-700 bg-blue-50">
                      Total: {karatSubtotal.toFixed(3)} g
                    </span>
                  </div>
                  {/* Karigars within this karat */}
                  <div className="space-y-1.5 pl-2 border-l-2 border-gray-100">
                    {karigarEntries.map(([name, val]) => (
                      <div key={name} className="flex justify-between items-center text-sm py-0.5">
                        <span className="font-semibold text-gray-600">{name}</span>
                        <span className="font-bold px-2.5 py-0.5 rounded text-xs text-blue-700 bg-blue-50 border border-blue-100">
                          {val.toFixed(3)} g
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic py-10 text-center">
            No records found for this selection.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Page Title */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Filling In Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">
          Review total gold issued (Filling In) details across workshops.
        </p>
      </div>

      {/* Main cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              Today's Total Filling In
            </span>
            <span className="text-3xl font-bold text-blue-600 mt-2 block">
              {todayFillingIn.toFixed(3)} g
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100 leading-relaxed">
            Gold issued to karigars today
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              This Month's Total Filling In
            </span>
            <span className="text-3xl font-bold text-indigo-600 mt-2 block">
              {monthFillingIn.toFixed(3)} g
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100 leading-relaxed">
            Gold issued to karigars this month
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              Filtered Total Filling In
            </span>
            <span className="text-3xl font-bold text-purple-600 mt-2 block">
              {filteredTotalFillingIn.toFixed(3)} g
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100 leading-relaxed">
            Based on the selected filters below
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            Filter Karigar Breakdown
          </h2>

          <div className="relative flex items-center bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            <Calendar className="w-4 h-4 text-gray-500 mr-2 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-sm text-gray-700 font-medium border-none outline-none pr-8 cursor-pointer focus:ring-0"
              id="analytics-date-filter"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>

        {/* Karat Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">
            Karat
          </div>
          {KARAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setKaratFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${karatFilter === opt.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 text-sm font-medium animate-pulse">Calculating reports...</p>
        </div>
      )}

      {/* Karigar Workload Breakdown */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6">
          {renderKarigarCard(
            'Filing Karigars Workload (Gold Issued)',
            <Hammer className="w-5 h-5 text-blue-600" />,
            fillingKarigarIn
          )}
        </div>
      )}
    </div>
  )
}
