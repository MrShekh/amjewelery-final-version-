'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SendWhatsAppButton from './SendWhatsAppButton'

interface Bill {
  id: string
  billNumber: string
  orderId?: string
  customerId: string
  orderDetails?: {
    id: string
    orderName: string
    orderPhoto?: string
    orderNumber?: string
    finalJewelryWeight: number
    actualFinalWeight?: number
    actualGoldWeight?: number
    totalStoneWeight?: number
    selectedKarat?: number
  }
  customerDetails?: {
    name: string
    phone: string
    email?: string
    address?: string
  }
  billing?: {
    actualGoldWeight: number
    actualGoldWeightInFineGold: number
    totalStoneWeight?: number
    manufacturingCostGrams: number
    totalCustomerOwedFineGold: number
    billingWeight: number
    billingWeightInFineGold: number
    includeStones: boolean
    notes?: string
  }
  status: string
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string
    email: string
  }
  // Legacy field for backward compatibility
  customer?: {
    name: string
    phone: string
    address?: string
  }
}

const BillsPage = () => {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [totalBills, setTotalBills] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const fetchBills = async (page = 1) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', pageSize.toString())
      if (filterStatus !== 'all') {
        params.set('status', filterStatus.toUpperCase())
      }
      if (debouncedSearchTerm) {
        params.set('search', debouncedSearchTerm)
      }

      const url = `/api/bills?${params.toString()}`
      const response = await fetch(url, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('📊 Bills API Response:', data)
        const payload = data.data || data
        console.log('📊 Bills count:', payload.bills?.length || 0)
        console.log('📊 Sample bill:', payload.bills?.[0])
        setBills(payload.bills || [])
        setTotalBills(payload.totalCount || (payload.bills?.length || 0))
        setTotalPages(payload.totalPages || 1)
      } else {
        console.error('Failed to fetch bills')
        alert('Failed to fetch bills')
        setBills([])
        setTotalBills(0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('Error fetching bills:', error)
      alert('Error fetching bills')
      setBills([])
      setTotalBills(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  // Debounce search so we don't hit the API on every keypress
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 400)

    return () => {
      clearTimeout(handler)
    }
  }, [searchTerm])

  useEffect(() => {
    setLoading(true)
    fetchBills(currentPage)
  }, [currentPage, filterStatus, debouncedSearchTerm])

  // Reset to first page whenever filters/search change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, debouncedSearchTerm])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'bg-blue-100 text-blue-800'
      case 'PAID': return 'bg-green-100 text-green-800'
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Server-side pagination + filtering: bills already respect search/filter
  const filteredBills = bills
  
  // Debug logging
  console.log('🔍 Total bills (all pages):', totalBills)
  console.log('🔍 Bills in current page:', bills.length)
  console.log('🔍 Search term:', searchTerm)
  console.log('🔍 Filter status:', filterStatus)

  const startIndex = totalBills === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = totalBills === 0 ? 0 : Math.min(currentPage * pageSize, totalBills)

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
          <h1 className="text-3xl font-bold text-gray-900">Customer Bills</h1>
          <p className="text-gray-600">View and manage all customer bills</p>
        </div>
        <div className="text-sm text-gray-500">
          Total Bills: {totalBills}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Bills
            </label>
            <input
              type="text"
              placeholder="Search by customer name, order name, or bill number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Bills</option>
              <option value="created">Created</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredBills.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No bills found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'No customer bills have been created yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bill Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Billing Summary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {bill.billNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(bill.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          By: {bill.createdBy.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {bill.customerDetails?.name || bill.customer?.name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {bill.customerDetails?.phone || bill.customer?.phone || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {bill.orderDetails ? (
                        <div className="flex items-center space-x-3">
                          {bill.orderDetails.orderPhoto ? (
                            <div className="flex-shrink-0">
                              <img 
                                src={bill.orderDetails.orderPhoto} 
                                alt={bill.orderDetails.orderName} 
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                              />
                            </div>
                          ) : (
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                                <span className="text-gray-400 text-xs">📷</span>
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {bill.orderDetails.orderName}
                              {!bill.orderDetails.orderPhoto && (
                                <span className="ml-2 text-xs text-red-500">(No Photo)</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {bill.orderDetails.orderNumber && `#${bill.orderDetails.orderNumber}`}
                            </div>
                            <div className="text-xs text-gray-400">
                              Final: {(bill.orderDetails.actualFinalWeight || bill.orderDetails.finalJewelryWeight || 0).toFixed(3)}g
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          Standalone Bill
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {bill.billing ? (
                          <>
                            <div className="text-gray-900 font-medium">
                              Total: {(bill.billing.totalCustomerOwedFineGold || 0).toFixed(3)}g
                            </div>
                            <div className="text-gray-500">
                              Gold: {(bill.billing.actualGoldWeightInFineGold || 0).toFixed(3)}g
                            </div>
                            <div className="text-gray-500">
                              Making: {(bill.billing.manufacturingCostGrams || 0).toFixed(3)}g
                            </div>
                            {bill.billing.totalStoneWeight && bill.billing.totalStoneWeight > 0 && (
                              <div className="text-purple-600">
                                Stones: {bill.billing.totalStoneWeight.toFixed(3)}g
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500 italic">
                            Billing details not available
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bill.status)}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col space-y-2">
                        <div className="flex space-x-2">
                          <Link
                            href={`/bills/${bill.id}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
                          >
                            View
                          </Link>
                          <Link
                            href={`/orders/${bill.orderId}`}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs"
                          >
                            Order
                          </Link>
                        </div>
                        <div className="flex space-x-2">
                          <SendWhatsAppButton 
                            billId={bill.id} 
                            customerName={bill.customerDetails?.name || bill.customer?.name}
                            customerPhone={bill.customerDetails?.phone || bill.customer?.phone}
                            size="sm"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalBills > 0 && (
        <div className="bg-white shadow-md rounded-lg p-4 flex items-center justify-between mt-4">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex}</span> to <span className="font-medium">{endIndex}</span> of{' '}
            <span className="font-medium">{totalBills}</span> bills
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                currentPage === 1
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-blue-600">
            {bills.filter(b => b.status === 'CREATED' && b.orderDetails).length}
          </div>
          <div className="text-sm text-gray-600">Created Bills</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-green-600">
            {bills.filter(b => b.status === 'PAID' && b.orderDetails).length}
          </div>
          <div className="text-sm text-gray-600">Paid Bills</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {bills.filter(b => b.status === 'PARTIAL' && b.orderDetails).length}
          </div>
          <div className="text-sm text-gray-600">Partial Payments</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-purple-600">
            {bills.filter(b => b.orderDetails).reduce((sum, bill) => sum + (bill.billing?.totalCustomerOwedFineGold || 0), 0).toFixed(3)}g
          </div>
          <div className="text-sm text-gray-600">Total Billed Gold</div>
        </div>
      </div>
    </div>
  )
}

export default BillsPage
