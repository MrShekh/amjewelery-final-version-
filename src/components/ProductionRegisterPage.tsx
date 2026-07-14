'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Download, Search, Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import RegisterDataTable from './RegisterDataTable'
import RegisterEditCellModal from './RegisterEditCellModal'
import DeleteConfirm from './DeleteConfirm'
import { useAuth } from '@/contexts/AuthContext'

interface Order {
  id: string
  selectedKarat?: number | string
  orderNumber?: string
  orderName: string
  fillingKarigar?: string
  fillingIn?: number
  fillingOut?: number
  fillingLoss?: number
  ad?: number
  adNote?: string
  klStone?: number
  klStoneNote?: string
  settingKarigar?: string
  settingLoss?: number
  polishKarigar?: string
  polishLoss?: number
  finishWeight?: number
  makingCharge?: number
  orderPhoto?: string
  status: string
}

interface Karigar {
  id: string
  name: string
  specialty?: string
}

export default function ProductionRegisterPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSearch = searchParams?.get('search') || ''

  const [orders, setOrders] = useState<Order[]>([])
  const [karigars, setKarigars] = useState<Karigar[]>([])
  const [totals, setTotals] = useState({})

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  })

  const [search, setSearch] = useState(initialSearch)
  const [dateFilter, setDateFilter] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)

  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Modals state
  const [editingCell, setEditingCell] = useState<{ order: Order; field: string; label: string } | null>(null)
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Toast notifications
  const [toast, setToast] = useState('')

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => {
      setToast('')
    }, 3000)
  }

  // Fetch register list
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('sessionToken')
      if (!token) return

      const url = `/api/orders?search=${encodeURIComponent(
        debouncedSearch
      )}&dateFilter=${dateFilter}&monthFilter=${selectedMonth}&page=${pagination.page}&limit=${pagination.limit}`

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()

      if (res.ok) {
        const payload = data.data || data
        setOrders(payload.orders || [])
        setTotals(payload.totals || {})
        setPagination({
          page: payload.page || 1,
          limit: payload.limit || 50,
          total: payload.totalCount || 0,
          totalPages: payload.totalPages || 1
        })
      } else {
        showToast(data.error || 'Failed to load orders')
      }
    } catch (err) {
      showToast('Network error loading orders')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, dateFilter, selectedMonth, pagination.page, pagination.limit])

  // Fetch all registered karigars
  const fetchKarigars = useCallback(async () => {
    try {
      const token = localStorage.getItem('sessionToken')
      if (!token) return

      const res = await fetch('/api/karigars', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (res.ok) {
        setKarigars(data.karigars || [])
      }
    } catch (err) {
      console.error('Error loading karigars:', err)
    }
  }, [])

  // Export Excel
  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('sessionToken')
      if (!token) return

      const url = `/api/orders/export?search=${encodeURIComponent(
        debouncedSearch
      )}&dateFilter=${dateFilter}&monthFilter=${selectedMonth}`

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) {
        throw new Error('Export failed')
      }

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl

      const today = new Date().toISOString().split('T')[0]
      a.download = `Production_Register_${selectedMonth !== 'all' ? selectedMonth : today}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
      showToast('Excel downloaded successfully!')
    } catch (err) {
      showToast('Failed to download Excel file')
    }
  }

  useEffect(() => {
    if (user) {
      fetchOrders()
      fetchKarigars()
    }
  }, [user, fetchOrders, fetchKarigars])

  // Save cell edit
  const handleSaveCellEdit = async (updatePayload: any) => {
    setActionLoading(true)
    try {
      const token = localStorage.getItem('sessionToken')
      const { orderId, field, ...data } = updatePayload

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ ...data, field }),
      })
      const resData = await res.json()

      if (res.ok) {
        showToast('Cell updated successfully!')
        setEditingCell(null)
        fetchOrders()
      } else {
        showToast(resData.error || 'Failed to update cell')
      }
    } catch (err) {
      showToast('Network error updating cell')
    } finally {
      setActionLoading(false)
    }
  }

  // Delete row
  const handleDeleteConfirm = async (orderId: string) => {
    setActionLoading(true)
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      const data = await res.json()

      if (res.ok) {
        showToast('Order deleted successfully')
        setDeletingOrder(null)
        fetchOrders()
      } else {
        showToast(data.error || 'Failed to delete order')
      }
    } catch (err) {
      showToast('Network error deleting order')
    } finally {
      setActionLoading(false)
    }
  }

  // Save Order Details (Marks status to COMPLETED and computes weights, stays on page)
  const handleSaveRow = async (order: Order) => {
    setActionLoading(true)
    try {
      const token = localStorage.getItem('sessionToken')

      // Update status to COMPLETED first (backend PUT route computes all weights automatically)
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
      const resData = await res.json()

      if (res.ok) {
        showToast('Order details saved successfully!')
        fetchOrders() // Refresh grid to fetch computed fields and updated totals
      } else {
        showToast(resData.error || 'Failed to save order details')
      }
    } catch (err) {
      showToast('Network error saving order details')
    } finally {
      setActionLoading(false)
    }
  }

  // Create Bill & Redirect to Billing
  const handleCreateBill = (order: Order) => {
    showToast('Opening billing page...')
    router.push(`/orders/${order.id}/bill/unified`)
  }

  // Inline upload photo shortcut
  const handlePhotoUploadShortcut = async (orderId: string, file: File) => {
    setActionLoading(true)
    try {
      const token = localStorage.getItem('sessionToken')
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData,
      })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        showToast(uploadData.error || 'Image upload failed')
        setActionLoading(false)
        return
      }

      // Update order with new Cloudinary photo URL
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ orderPhoto: uploadData.url }),
      })

      if (res.ok) {
        showToast('Order photo updated!')
        fetchOrders()
      } else {
        showToast('Failed to link new photo to order')
      }
    } catch (err) {
      showToast('Network error uploading image')
    } finally {
      setActionLoading(false)
    }
  }

  // Generate Excel-like month tabs dynamically: past 6 months in chronological order
  const monthTabs = [
    { label: 'All Time', value: 'all' },
    ...Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      return {
        label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }
    })
  ]

  const handleMonthTabSelect = (monthVal: string) => {
    setSelectedMonth(monthVal)
    setDateFilter('all') // Reset date filter to avoid conflict
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleDateFilterChange = (filterVal: string) => {
    setDateFilter(filterVal)
    setSelectedMonth('all') // Reset month selection to avoid conflict
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  return (
    <div className="flex-1 flex flex-col p-6 space-y-4">
      {/* Toolbar controls */}
      <div className="bg-surface border border-border rounded-xl p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground mr-4">Production Register</h1>
            {/* New Order Button */}
            <Link
              href="/orders/new"
              className="btn btn-primary btn-sm"
              id="new-order-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              New Order
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-light" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bag no. or order..."
                className="input input-sm pl-8 text-foreground"
                id="search-input"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-light hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Filter */}
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-light pointer-events-none" />
              <select
                value={dateFilter}
                onChange={(e) => handleDateFilterChange(e.target.value)}
                className="input input-sm pl-8 pr-8 appearance-none cursor-pointer min-w-[120px] text-foreground"
                id="date-filter"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            {/* Export Excel Button in Toolbar */}
            <button
              onClick={handleExportExcel}
              disabled={loading || actionLoading}
              className="btn btn-secondary btn-sm flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 font-semibold"
              title="Export Current Filter to Excel"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div className="text-center py-2 text-xs text-primary font-medium animate-pulse">
          Loading production register...
        </div>
      )}

      {/* Main Grid View */}
      <RegisterDataTable
        orders={orders}
        totals={totals}
        onEditCell={(order, field, label) => setEditingCell({ order, field, label })}
        onDeleteRow={(order) => setDeletingOrder(order)}
        onImageClick={(url) => setPreviewImage(url)}
        onPhotoUpload={handlePhotoUploadShortcut}
        onSaveRow={handleSaveRow}
        onCreateBill={handleCreateBill}
        page={pagination.page}
        limit={pagination.limit}
      />

      {/* Month sheet tabs at the bottom (Excel-style) */}
      <div className="bg-surface border border-border rounded-xl p-2.5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 overflow-x-auto">
        <div className="flex items-center space-x-1 min-w-0 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-text-muted px-2 uppercase tracking-wider select-none whitespace-nowrap">Sheets:</span>
          {monthTabs.map((tab) => {
            const isActive = selectedMonth === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => handleMonthTabSelect(tab.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 flex items-center gap-1 whitespace-nowrap ${isActive
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-background hover:bg-accent/10 text-foreground border-border'
                  }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Download current sheet button */}
        <button
          onClick={handleExportExcel}
          disabled={loading || actionLoading}
          className="btn btn-secondary btn-sm flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 font-semibold self-end sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Download Current Sheet
        </button>
      </div>

      {/* Pagination bottom */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1 text-foreground">
          <div className="text-xs text-text-muted">
            Showing <span className="font-semibold text-foreground">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
            <span className="font-semibold text-foreground">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
            <span className="font-semibold text-foreground">{pagination.total}</span> orders
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1 || loading}
              className="btn btn-secondary btn-sm p-1.5"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
              if (
                p === 1 ||
                p === pagination.totalPages ||
                (p >= pagination.page - 1 && p <= pagination.page + 1)
              ) {
                return (
                  <button
                    key={p}
                    onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
                    className={`btn btn-sm min-w-[32px] justify-center ${pagination.page === p ? 'btn-primary' : 'btn-secondary'
                      }`}
                  >
                    {p}
                  </button>
                )
              } else if (p === pagination.page - 2 || p === pagination.page + 2) {
                return (
                  <span key={p} className="px-1.5 text-text-light text-xs">
                    ...
                  </span>
                )
              }
              return null
            })}

            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages || loading}
              className="btn btn-secondary btn-sm p-1.5"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Cell Modal */}
      {editingCell && (
        <RegisterEditCellModal
          order={editingCell.order}
          field={editingCell.field}
          label={editingCell.label}
          onClose={() => setEditingCell(null)}
          onSave={handleSaveCellEdit}
          loading={actionLoading}
          karigars={karigars}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingOrder && (
        <DeleteConfirm
          order={{ bagNumber: deletingOrder.orderNumber || '', orderName: deletingOrder.orderName, status: deletingOrder.status }}
          onClose={() => setDeletingOrder(null)}
          onConfirm={() => handleDeleteConfirm(deletingOrder.id)}
          loading={actionLoading}
        />
      )}

      {/* Image Preview Overlay */}
      {previewImage && (
        <div className="image-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Order full preview" className="max-w-[90vw] max-h-[90vh] rounded-lg" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-foreground text-white border border-border rounded-full flex items-center justify-center shadow hover:bg-black/80"
              aria-label="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast popup alerts */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
