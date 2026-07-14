'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  createdAt: string
  orders: Array<{
    id: string
    status: string
    totalGoldUsed: number
    createdAt: string
  }>
  jamaGold?: {
    summary?: {
      totalJamaGold?: number
      totalJamaReturned?: number
      totalJamaPending?: number
      returnPercentage?: number
    }
  }
}

const CustomersPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  })

  const fetchCustomers = async (page = 1, search = '') => {
    try {
      setTableLoading(true)
      const sessionToken = localStorage.getItem('sessionToken')

      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', pageSize.toString())
      if (search) {
        params.set('search', search)
      }

      const url = `/api/customers?${params.toString()}`
      const response = await fetch(url, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (!response.ok) {
        console.error('Customers fetch failed:', response.status)
        setCustomers([])
        setFilteredCustomers([])
        setTotalCustomers(0)
        setTotalPages(1)
        return
      }

      const data = await response.json()
      const payload = data.data || data
      const list = payload.customers || []
      setCustomers(list)
      setFilteredCustomers(list)
      setTotalCustomers(payload.totalCount || list.length)
      setTotalPages(payload.totalPages || 1)
    } catch (error) {
      console.error('Error fetching customers:', error)
      setCustomers([])
      setFilteredCustomers([])
      setTotalCustomers(0)
      setTotalPages(1)
    } finally {
      setTableLoading(false)
      setInitialLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchCustomers(1, '')
  }, [])

  // Handle search submission
  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
    fetchCustomers(1, searchInput)
  }

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Handle reset
  const handleReset = () => {
    setSearchInput('')
    setSearchQuery('')
    setCurrentPage(1)
    fetchCustomers(1, '')
  }

  // Fetch when page changes (but keep current search)
  useEffect(() => {
    if (!initialLoading) {
      fetchCustomers(currentPage, searchQuery)
    }
  }, [currentPage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setShowModal(false)
        setFormData({ name: '', phone: '', email: '', address: '' })
        fetchCustomers()
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Failed to create customer')
    }
  }

  const handleDelete = async (customerId: string, customerName: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete customer "${customerName}"?\n\n⚠️ This will permanently remove the customer and all their data from the database. This action cannot be undone.`
    )

    if (!confirmed) return

    setDeleting(customerId)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
      })

      if (response.ok) {
        // Remove customer from state immediately for better UX
        setCustomers(prev => prev.filter(c => c.id !== customerId))
        alert(`Customer "${customerName}" has been deleted successfully.`)
      } else {
        const error = await response.json()
        alert(`Failed to delete customer: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Failed to delete customer. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  const startIndex = totalCustomers === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = totalCustomers === 0 ? 0 : Math.min(currentPage * pageSize, totalCustomers)

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          Add Customer
        </button>
      </div>

      {/* Search Bar and Statistics */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search customers by name, phone, email, or address..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <div className="flex items-center space-x-2 ml-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Search
            </button>
            {searchQuery && (
              <button
                onClick={handleReset}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Reset List
              </button>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-blue-600 font-medium">Total Customers</div>
            <div className="text-2xl font-bold text-blue-900">{totalCustomers}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-green-600 font-medium">Showing (this page)</div>
            <div className="text-2xl font-bold text-green-900">{filteredCustomers.length}</div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="text-yellow-600 font-medium">With Active Orders</div>
            <div className="text-2xl font-bold text-yellow-900">
              {filteredCustomers.filter(c =>
                c.orders.some(o => o.status === 'CREATED' || o.status === 'IN_PROCESS')
              ).length}
            </div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="text-purple-600 font-medium">With Pending Jama</div>
            <div className="text-2xl font-bold text-purple-900">
              {filteredCustomers.filter(c =>
                c.jamaGold?.summary?.totalJamaPending && c.jamaGold.summary.totalJamaPending > 0
              ).length}
            </div>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orders
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Gold Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pending Gold
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recovered Gold
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Jama Gold
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tableLoading ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading customers...</span>
                  </div>
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? `No customers found matching "${searchQuery}"` : 'No customers found'}
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer, index) => {
                const totalGoldUsed = customer.orders.reduce((sum, order) => sum + order.totalGoldUsed, 0)
                const activeOrders = customer.orders.filter(order =>
                  order.status === 'CREATED' || order.status === 'IN_PROCESS'
                ).length

                return (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                          {index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">
                          Joined {new Date(customer.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.phone || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{customer.email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.orders.length} total
                      </div>
                      <div className="text-sm text-gray-500">
                        {activeOrders} active
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {totalGoldUsed.toFixed(2)}g
                    </td>
                    {/* Pending Gold */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.jamaGold?.summary?.totalJamaPending && customer.jamaGold.summary.totalJamaPending > 0 ? (
                        <div className="text-sm font-medium text-red-600">
                          {customer.jamaGold.summary.totalJamaPending.toFixed(2)}g
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">0.00g</div>
                      )}
                    </td>
                    {/* Recovered Gold */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.jamaGold?.summary?.totalJamaReturned && customer.jamaGold.summary.totalJamaReturned > 0 ? (
                        <div className="text-sm font-medium text-green-600">
                          {customer.jamaGold.summary.totalJamaReturned.toFixed(2)}g
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">0.00g</div>
                      )}
                    </td>
                    {/* Total Jama Gold */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.jamaGold?.summary?.totalJamaGold && customer.jamaGold.summary.totalJamaGold > 0 ? (
                        <div className="text-sm font-medium text-blue-600">
                          {customer.jamaGold.summary.totalJamaGold.toFixed(2)}g
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">0.00g</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                        >
                          View
                        </Link>
                        <Link
                          href={`/orders/new?customerId=${customer.id}`}
                          className="text-green-600 hover:text-green-900 transition-colors"
                        >
                          New Order
                        </Link>
                        <button
                          onClick={() => handleDelete(customer.id, customer.name)}
                          disabled={deleting === customer.id}
                          className={`${deleting === customer.id
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-900'
                            } transition-colors font-medium`}
                          title={`Delete customer ${customer.name}`}
                        >
                          {deleting === customer.id ? (
                            <div className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Deleting...
                            </div>
                          ) : (
                            'Delete'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalCustomers > 0 && (
        <div className="bg-white shadow-md rounded-lg p-4 flex items-center justify-between mt-4">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex}</span> to <span className="font-medium">{endIndex}</span> of{' '}
            <span className="font-medium">{totalCustomers}</span> customers
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${currentPage === 1
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
              className={`px-4 py-2 text-sm font-medium rounded-lg ${currentPage === totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Customer</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <textarea
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-4 pt-4">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    Add Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setFormData({ name: '', phone: '', email: '', address: '' })
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomersPage
