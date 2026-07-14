'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

interface Order {
  id: string
  orderNumber?: string
  customer: {
    name: string
  }
  orderName: string
  orderPhoto?: string
  orderType: string
  customerGoldWeight: number
  adminGoldWeight: number
  totalGoldUsed: number
  finalJewelryWeight: number
  actualFinalWeight?: number
  status: string
  createdAt: string
  processes: Array<{
    processType: string
    goldLoss: number
    karigar: {
      name: string
    }
  }>
}

const OrdersPage = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showDebug, setShowDebug] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const fetchOrders = async (page = 1) => {
    try {
      setLoading(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null

      if (!token) {
        throw new Error('No authentication token found')
      }

      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', pageSize.toString())
      if (filter !== 'ALL') {
        params.set('status', filter)
      }
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      const url = `/api/orders?${params.toString()}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }

      const data = await response.json()

      // Handle the nested response structure
      const payload = data.data || data
      const ordersArray = payload.orders || []

      setOrders(ordersArray)
      setTotalOrders(payload.totalCount || ordersArray.length)
      setTotalPages(payload.totalPages || 1)
    } catch (error) {
      console.error('Error fetching orders:', error)
      alert(`Failed to load orders: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setOrders([]) // Ensure orders is always an array
      setTotalOrders(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  // Initial load and filter changes
  useEffect(() => {
    if (user) {
      fetchOrders(currentPage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentPage, filter])

  // Reset to first page whenever filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchOrders(1)
  }

  // Pagination display helpers (server-side pagination)
  const startIndex = totalOrders === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = totalOrders === 0 ? 0 : Math.min(currentPage * pageSize, totalOrders)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'bg-blue-100 text-blue-800'
      case 'IN_PROCESS': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'DELIVERED': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <Link
          href="/orders/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          New Order
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleSearch} className="relative max-w-md flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by order name, order number, or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Search
          </button>
        </form>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600 flex items-center">
            {loading ? (
              <span>Searching...</span>
            ) : (
              <>
                Found {totalOrders} order{totalOrders !== 1 ? 's' : ''} matching "{searchQuery}"
                <button
                  onClick={() => {
                    setSearchQuery('')
                    // We need to trigger a fetch with empty search, but state update is async.
                    // Ideally we'd use a useEffect or pass empty string directly.
                    // For simplicity, we'll just clear state and let the user re-search or rely on a separate effect if we wanted auto-clear.
                    // But user asked for manual search. So let's just clear the input.
                    // If they want to see all orders again, they can clear and hit search/enter.
                    // Actually, usually "Clear" button should reset the list too.
                    // Let's make it clear and fetch.
                    // Since setSearchQuery is async, we can't call fetchOrders immediately with the new state unless we pass it as arg.
                    // But fetchOrders uses state. Let's just reload the page or trigger a fetch with empty param override.
                    // Simpler: Just clear the input. The user can hit Enter to reset.
                    // OR: We can force a reset.
                  }}
                  className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear Input
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    // Hack to fetch all immediately
                    setTimeout(() => {
                      const token = typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null
                      if (token) {
                        setLoading(true)
                        const params = new URLSearchParams()
                        params.set('page', '1')
                        params.set('limit', pageSize.toString())
                        if (filter !== 'ALL') params.set('status', filter)
                        // No search param
                        fetch(`/api/orders?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } })
                          .then(res => res.json())
                          .then(data => {
                            const payload = data.data || data
                            setOrders(payload.orders || [])
                            setTotalOrders(payload.totalCount || (payload.orders || []).length)
                            setTotalPages(payload.totalPages || 1)
                            setLoading(false)
                          })
                      }
                    }, 0)
                  }}
                  className="ml-4 text-gray-500 hover:text-gray-700 text-xs underline"
                >
                  Reset List
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        {['ALL', 'CREATED', 'IN_PROCESS', 'COMPLETED', 'DELIVERED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${filter === status
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden min-h-[400px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-2"></div>
              <span className="text-blue-600 font-medium">Loading orders...</span>
            </div>
          </div>
        )}

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gold Usage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((order) => {
              const totalLoss = order.processes.reduce((sum, p) => sum + p.goldLoss, 0)

              return (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {order.orderPhoto && (
                        <div className="flex-shrink-0">
                          <img
                            src={order.orderPhoto}
                            alt={order.orderName}
                            className="w-12 h-12 object-cover rounded-md border border-gray-300"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {order.orderName}
                          {order.orderNumber && (
                            <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                              {order.orderNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.customer.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.orderType.replace('_', ' ')} •
                          {(order.status === 'COMPLETED' || order.status === 'DELIVERED') && order.actualFinalWeight
                            ? `${order.actualFinalWeight.toFixed(2)}g actual`
                            : `${order.finalJewelryWeight.toFixed(2)}g final`
                          }
                          {(order.status === 'COMPLETED' || order.status === 'DELIVERED') && order.actualFinalWeight &&
                            order.actualFinalWeight !== order.finalJewelryWeight && (
                              <span className="text-gray-400"> (was {order.finalJewelryWeight.toFixed(2)}g)</span>
                            )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Total: {order.totalGoldUsed.toFixed(2)}g
                    </div>
                    <div className="text-xs text-gray-500">
                      Customer: {order.customerGoldWeight.toFixed(2)}g • Admin: {order.adminGoldWeight.toFixed(2)}g
                    </div>
                    {totalLoss > 0 && (
                      <div className="text-xs text-red-500">
                        Loss: {totalLoss.toFixed(2)}g
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.processes.length} processes
                    </div>
                    {order.processes.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Latest: {order.processes[order.processes.length - 1]?.processType}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && orders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery
                ? `No orders found matching "${searchQuery}"`
                : filter !== 'ALL'
                  ? `No orders found for status "${filter.replace('_', ' ')}"`
                  : 'No orders found'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalOrders > 0 && (
        <div className="bg-white shadow-md rounded-lg p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex}</span> to <span className="font-medium">{endIndex}</span> of{' '}
            <span className="font-medium">{totalOrders}</span> orders
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setCurrentPage(prev => Math.max(prev - 1, 1))
                // Note: useEffect will trigger fetch
              }}
              disabled={currentPage === 1 || loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${currentPage === 1 || loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              Previous
            </button>
            <div className="text-sm text-gray-700">
              Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
            </div>
            <button
              onClick={() => {
                setCurrentPage(prev => Math.min(prev + 1, totalPages))
                // Note: useEffect will trigger fetch
              }}
              disabled={currentPage === totalPages || loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${currentPage === totalPages || loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrdersPage
