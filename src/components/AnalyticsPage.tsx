'use client'

import { useState, useEffect, useCallback } from 'react'
import { Scale, Calendar, Filter, BarChart3, Download, Trash2, Info } from 'lucide-react'
import * as XLSX from 'xlsx'

interface KaratTotalItem {
  karat: number
  fillingIn: number
  finishWeight: number
  karigarLoss: number
  fineFillingIn: number
  fineFinishWeight: number
  fineKarigarLoss: number
}

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
  const [todayFinishWeight, setTodayFinishWeight] = useState(0)
  const [todayKarigarLoss, setTodayKarigarLoss] = useState(0)

  const [monthFillingIn, setMonthFillingIn] = useState(0)
  const [monthFinishWeight, setMonthFinishWeight] = useState(0)
  const [monthKarigarLoss, setMonthKarigarLoss] = useState(0)

  const [filteredTotalFillingIn, setFilteredTotalFillingIn] = useState(0)
  const [filteredFinishWeight, setFilteredFinishWeight] = useState(0)
  const [filteredKarigarLoss, setFilteredKarigarLoss] = useState(0)

  const [karatTotals, setKaratTotals] = useState<Record<string, KaratTotalItem>>({})
  const [dateFilter, setDateFilter] = useState('all')
  const [karatFilter, setKaratFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  // ─── Analytics snapshot (clear date) ────────────────────────────────────────
  const [clearedAt, setClearedAt] = useState<string | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Fetch clear date from server ───────────────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const res = await fetch('/api/analytics/snapshot', {
        headers: { Authorization: sessionToken ? `Bearer ${sessionToken}` : '' },
      })
      if (res.ok) {
        const data = await res.json()
        setClearedAt(data.clearedAt ?? null)
      }
    } catch (err) {
      console.error('Failed to fetch analytics snapshot', err)
    }
  }, [])

  useEffect(() => {
    fetchSnapshot()
  }, [fetchSnapshot])

  // ── Main data fetch ────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      // Build clearedAfter param
      const clearedParam = clearedAt ? `&clearedAfter=${encodeURIComponent(clearedAt)}` : ''

      const [todayRes, monthRes, filteredRes] = await Promise.all([
        fetch(`/api/orders?dateFilter=today&limit=1&forAnalytics=true${clearedParam}`, {
          headers: { Authorization: sessionToken ? `Bearer ${sessionToken}` : '' },
        }),
        fetch(`/api/orders?dateFilter=month&limit=1&forAnalytics=true${clearedParam}`, {
          headers: { Authorization: sessionToken ? `Bearer ${sessionToken}` : '' },
        }),
        fetch(`/api/orders?dateFilter=${dateFilter}&karatFilter=${karatFilter}&limit=1&forAnalytics=true${clearedParam}`, {
          headers: { Authorization: sessionToken ? `Bearer ${sessionToken}` : '' },
        }),
      ])

      const todayData = await todayRes.json()
      const monthData = await monthRes.json()
      const filteredData = await filteredRes.json()

      if (todayData.success) {
        setTodayFillingIn(todayData.data?.totals?.fillingIn || 0)
        setTodayFinishWeight(todayData.data?.totals?.finishWeight || 0)
        setTodayKarigarLoss(todayData.data?.totals?.fillingLoss || 0)
      }
      if (monthData.success) {
        setMonthFillingIn(monthData.data?.totals?.fillingIn || 0)
        setMonthFinishWeight(monthData.data?.totals?.finishWeight || 0)
        setMonthKarigarLoss(monthData.data?.totals?.fillingLoss || 0)
      }
      if (filteredData.success) {
        setFilteredTotalFillingIn(filteredData.data?.totals?.fillingIn || 0)
        setFilteredFinishWeight(filteredData.data?.totals?.finishWeight || 0)
        setFilteredKarigarLoss(filteredData.data?.totals?.fillingLoss || 0)
        setKaratTotals(filteredData.data?.karatTotals || {})
      }
    } catch (err) {
      console.error('Failed to load analytics', err)
    } finally {
      setLoading(false)
    }
  }, [dateFilter, karatFilter, clearedAt])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // ─── Save snapshot to local device (Excel) ────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-')
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

      // Header rows
      const titleRow = [`AM Jewellers — Production Analytics Snapshot`]
      const subtitleRow = [`Saved on: ${dateStr} at ${timeStr}`]
      const clearedRow = clearedAt
        ? [`Analytics period started from: ${new Date(clearedAt).toLocaleString('en-IN')}`]
        : [`Analytics period: All time`]
      const blank: string[] = []

      // Summary rows
      const summaryHeader = ['Section', 'Filling In (g)', 'Finish Weight (g)', 'Karigar Loss (g)']
      const todaySummary = ["Today's Summary", todayFillingIn.toFixed(3), todayFinishWeight.toFixed(3), todayKarigarLoss.toFixed(3)]
      const monthSummary = ["This Month's Summary", monthFillingIn.toFixed(3), monthFinishWeight.toFixed(3), monthKarigarLoss.toFixed(3)]
      const filteredSummary = ['Filtered Summary', filteredTotalFillingIn.toFixed(3), filteredFinishWeight.toFixed(3), filteredKarigarLoss.toFixed(3)]

      const blank2: string[] = []
      // Karat table header
      const tableHeader = [
        'Karat',
        'Filling In Karat Wt (g)',
        'Filling In Fine Wt (g)',
        'Finish Weight Karat Wt (g)',
        'Finish Weight Fine Wt (g)',
        'Karigar Loss Karat Wt (g)',
        'Karigar Loss Fine Wt (g)',
      ]

      const tableRows = Object.keys(karatTotals)
        .sort((a, b) => parseFloat(b) - parseFloat(a))
        .map((k) => {
          const item = karatTotals[k]
          return [
            getKaratLabel(item.karat),
            item.fillingIn.toFixed(3),
            item.fineFillingIn.toFixed(3),
            item.finishWeight.toFixed(3),
            item.fineFinishWeight.toFixed(3),
            item.karigarLoss.toFixed(3),
            item.fineKarigarLoss.toFixed(3),
          ]
        })

      const gTotals = Object.values(karatTotals).reduce(
        (acc, curr) => {
          acc.fillingIn += curr.fillingIn
          acc.fineFillingIn += curr.fineFillingIn
          acc.finishWeight += curr.finishWeight
          acc.fineFinishWeight += curr.fineFinishWeight
          acc.karigarLoss += curr.karigarLoss
          acc.fineKarigarLoss += curr.fineKarigarLoss
          return acc
        },
        { fillingIn: 0, fineFillingIn: 0, finishWeight: 0, fineFinishWeight: 0, karigarLoss: 0, fineKarigarLoss: 0 }
      )

      const totalsRow = [
        'GRAND TOTAL',
        gTotals.fillingIn.toFixed(3),
        gTotals.fineFillingIn.toFixed(3),
        gTotals.finishWeight.toFixed(3),
        gTotals.fineFinishWeight.toFixed(3),
        gTotals.karigarLoss.toFixed(3),
        gTotals.fineKarigarLoss.toFixed(3),
      ]

      const wsData = [
        titleRow,
        subtitleRow,
        clearedRow,
        blank,
        summaryHeader,
        todaySummary,
        monthSummary,
        filteredSummary,
        blank2,
        tableHeader,
        ...tableRows,
        blank,
        totalsRow,
      ]

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [
        { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 26 }, { wch: 26 }, { wch: 26 }, { wch: 26 },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Analytics Snapshot')
      XLSX.writeFile(wb, `Analytics_Snapshot_${dateStr}.xlsx`)
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save analytics snapshot.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Clear analytics (save snapshot then reset) ───────────────────────────
  const handleClear = async () => {
    setShowClearConfirm(false)
    setSnapshotLoading(true)
    try {
      // 1. Auto-save first (so data isn't lost)
      await handleSave()

      // 2. Record new clearedAt on server
      const sessionToken = localStorage.getItem('sessionToken')
      const res = await fetch('/api/analytics/snapshot', {
        method: 'POST',
        headers: {
          Authorization: sessionToken ? `Bearer ${sessionToken}` : '',
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const err = await res.json()
        alert(`Failed to clear analytics: ${err.error}`)
        return
      }

      const data = await res.json()
      setClearedAt(data.clearedAt)
    } catch (err) {
      console.error('Clear error:', err)
      alert('Failed to clear analytics. Please try again.')
    } finally {
      setSnapshotLoading(false)
    }
  }

  const getKaratLabel = (karat: number | string): string => {
    const num = typeof karat === 'string' ? parseFloat(karat) : karat
    switch (num) {
      case 92: return '22k (92%)'
      case 75.5: return '18k (75.5%)'
      case 80: return '19.2k (80%)'
      case 75: return '18k (75%)'
      case 76: return '18k (76%)'
      case 88: return '21k (88%)'
      case 59: return '14k (59%)'
      case 37.5: return '9k (37.5%)'
      default: return `${num}%`
    }
  }

  // Calculate grand totals for the table
  const grandTotals = Object.values(karatTotals).reduce((acc, curr) => {
    acc.fillingIn += curr.fillingIn
    acc.fineFillingIn += curr.fineFillingIn
    acc.finishWeight += curr.finishWeight
    acc.fineFinishWeight += curr.fineFinishWeight
    acc.karigarLoss += curr.karigarLoss
    acc.fineKarigarLoss += curr.fineKarigarLoss
    return acc
  }, {
    fillingIn: 0,
    fineFillingIn: 0,
    finishWeight: 0,
    fineFinishWeight: 0,
    karigarLoss: 0,
    fineKarigarLoss: 0
  })

  const isBusy = snapshotLoading || saving

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Page Title */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">
            Review gold issued, finished weights, and total loss across different purities.
          </p>
          {clearedAt && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3 inline" />
              Showing data since: {new Date(clearedAt).toLocaleString('en-IN')}
            </p>
          )}
        </div>

        {/* ── Save & Clear Buttons ── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Save Button */}
          <button
            id="analytics-save-btn"
            onClick={handleSave}
            disabled={isBusy}
            title="Save current analytics as Excel file to your device"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isBusy
              ? 'bg-blue-200 text-white cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Save Analytics
              </>
            )}
          </button>

          {/* Clear Button */}
          <button
            id="analytics-clear-btn"
            onClick={() => setShowClearConfirm(true)}
            disabled={isBusy}
            title="Save current analytics to Excel, then reset analytics to 0 from now"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isBusy
              ? 'bg-red-200 text-white cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
          >
            {snapshotLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Clearing…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Save &amp; Clear
              </>
            )}
          </button>

          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl hidden sm:block">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Clear Confirmation Modal ── */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Save &amp; Clear Analytics?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
              <p className="font-semibold">What will happen:</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li>Current analytics data will be <strong>saved as an Excel file</strong> to your device automatically</li>
                <li>Analytics will <strong>reset to 0.000 g</strong> from this moment</li>
                <li>Only <strong>new orders</strong> created after this point will count in analytics</li>
                <li>Old orders are <strong>not deleted</strong> — they are just excluded from the view</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Save &amp; Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-4 border-b pb-2">
              Today&apos;s Summary
            </span>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Filling In:</span>
                <span className="text-base font-bold text-blue-600">{todayFillingIn.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Finish Weight:</span>
                <span className="text-base font-bold text-emerald-600">{todayFinishWeight.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2 border-dashed border-gray-100">
                <span className="text-sm font-medium text-gray-500">Karigar Loss:</span>
                <span className="text-base font-bold text-rose-600">{todayKarigarLoss.toFixed(3)} g</span>
              </div>
            </div>
          </div>
        </div>

        {/* This Month Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-4 border-b pb-2">
              This Month&apos;s Summary
            </span>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Filling In:</span>
                <span className="text-base font-bold text-indigo-600">{monthFillingIn.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Finish Weight:</span>
                <span className="text-base font-bold text-emerald-600">{monthFinishWeight.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2 border-dashed border-gray-100">
                <span className="text-sm font-medium text-gray-500">Karigar Loss:</span>
                <span className="text-base font-bold text-rose-600">{monthKarigarLoss.toFixed(3)} g</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filtered Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-4 border-b pb-2">
              Filtered Summary
            </span>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Filling In:</span>
                <span className="text-base font-bold text-purple-600">{filteredTotalFillingIn.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Finish Weight:</span>
                <span className="text-base font-bold text-emerald-600">{filteredFinishWeight.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2 border-dashed border-gray-100">
                <span className="text-sm font-medium text-gray-500">Karigar Loss:</span>
                <span className="text-base font-bold text-rose-600">{filteredKarigarLoss.toFixed(3)} g</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            Filter Analytics
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

      {/* Karat & Fine Weight Analytics Summary Table */}
      {!loading && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-600" />
              Karat &amp; Fine Weight Analytics Summary
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="px-6 py-3.5">Karat</th>
                  <th className="px-6 py-3.5 text-right">Filling In (Karat Wt)</th>
                  <th className="px-6 py-3.5 text-right text-blue-600 bg-blue-50/50">Filling In (Fine Wt)</th>
                  <th className="px-6 py-3.5 text-right">Finish Weight (Karat Wt)</th>
                  <th className="px-6 py-3.5 text-right text-emerald-600 bg-emerald-50/30">Finish Weight (Fine Wt)</th>
                  <th className="px-6 py-3.5 text-right">Karigar Loss (Karat Wt)</th>
                  <th className="px-6 py-3.5 text-right text-rose-600 bg-rose-50/30">Karigar Loss (Fine Wt)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {Object.keys(karatTotals).length > 0 ? (
                  Object.keys(karatTotals).sort((a, b) => parseFloat(b) - parseFloat(a)).map((karatKey) => {
                    const item = karatTotals[karatKey]
                    return (
                      <tr key={karatKey} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {getKaratLabel(item.karat)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          {item.fillingIn.toFixed(3)} g
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-blue-600 bg-blue-50/30">
                          {item.fineFillingIn.toFixed(3)} g
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          {item.finishWeight.toFixed(3)} g
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600 bg-emerald-50/10">
                          {item.fineFinishWeight.toFixed(3)} g
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-rose-600">
                          {item.karigarLoss.toFixed(3)} g
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600 bg-rose-50/10">
                          {item.fineKarigarLoss.toFixed(3)} g
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 italic">
                      No records found for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
              {Object.keys(karatTotals).length > 0 && (
                <tfoot>
                  <tr className="bg-gray-900 text-white font-bold text-sm border-t-2 border-blue-600">
                    <td className="px-6 py-4 uppercase tracking-wider">Total</td>
                    <td className="px-6 py-4 text-right">{grandTotals.fillingIn.toFixed(3)} g</td>
                    <td className="px-6 py-4 text-right text-blue-300 bg-blue-950">{grandTotals.fineFillingIn.toFixed(3)} g</td>
                    <td className="px-6 py-4 text-right">{grandTotals.finishWeight.toFixed(3)} g</td>
                    <td className="px-6 py-4 text-right text-emerald-300 bg-emerald-950/50">{grandTotals.fineFinishWeight.toFixed(3)} g</td>
                    <td className="px-6 py-4 text-right text-rose-300">{grandTotals.karigarLoss.toFixed(3)} g</td>
                    <td className="px-6 py-4 text-right text-rose-300 bg-rose-950/50">{grandTotals.fineKarigarLoss.toFixed(3)} g</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
