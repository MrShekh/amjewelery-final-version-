'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import RegisterDataTable from './RegisterDataTable'

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  createdAt: string
  updatedAt: string
  orders: OrderWithDetails[]
  jamaGold?: {
    balances: JamaBalance[]
    summary: {
      totalJamaGold: number
      totalJamaReturned: number
      totalJamaPending: number
      returnPercentage: number
    }
  }
  advanceGold?: {
    totalAdvanceGold: number
  }
  transactions?: GoldTransaction[]
}

interface JamaBalance {
  id: string
  customerId: string
  orderId: string
  jamaGoldAmount: number
  goldBalance?: number  // New field for billing entries
  returnedAmount: number
  pendingAmount: number
  description: string
  notes?: string  // Additional description field
  createdAt: string
  updatedAt: string
  order?: {
    id: string
    orderName: string
    status: string
  } | null
}

interface OrderWithDetails {
  id: string
  orderName: string
  orderPhoto?: string // Order image URL
  orderType: 'CUSTOMER_GOLD' | 'ADMIN_GOLD' | 'MIXED'
  status: 'CREATED' | 'IN_PROCESS' | 'COMPLETED' | 'DELIVERED'
  customerGoldWeight: number
  adminGoldWeight: number
  totalGoldUsed: number
  finalJewelryWeight: number
  actualFinalWeight?: number
  actualGoldWeight?: number // Actual gold weight after removing stones
  totalStoneWeight?: number // Total weight of stones added
  selectedKarat?: number // Karat purity (92, 88, 80, 76, 75.5, 75, 59, 37.5)
  manufacturingCost: number
  adminProfitGold: number
  createdAt: string
  updatedAt: string
  processes: ProcessWithKarigar[]
  transactions: GoldTransaction[]
  billing?: {
    goldToReturn: number
    manufacturingCostDue: number
    goldReturned: number
    manufacturingCostPaid: number
    goldPending: number
    costPending: number
    totalBillAmount: number
    billingCompleted: boolean
  }
}

interface ProcessWithKarigar {
  id: string
  processType: string
  inputWeight: number
  outputWeight: number
  goldLoss: number
  goldRecovered?: number
  sequence: number
  karigar: {
    id: string
    name: string
  } | null
}

interface GoldTransaction {
  id: string
  type: string
  amount: number
  description: string
  recoveredGold: number
  createdAt: string
}

interface OrderFinancials {
  adminGoldProvided: number
  totalGoldLoss: number
  totalGoldRecovered: number
  pendingGoldRecovery: number
  manufacturingCost: number
  paidAmount: number
  pendingPayment: number
  recoveryPercentage: number
}

interface CustomerDetailPageProps {
  customerId: string
}

const CustomerDetailPage: React.FC<CustomerDetailPageProps> = ({ customerId }) => {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  })
  // Image preview state (read-only, for viewing photos)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Gold collection state
  const [showCollectModal, setShowCollectModal] = useState(false)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectDescription, setCollectDescription] = useState('')
  const [collecting, setCollecting] = useState(false)

  // Manual add gold state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addAmount, setAddAmount] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [adding, setAdding] = useState(false)

  // Daily report state
  const getTodayDateString = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const [reportDate, setReportDate] = useState(getTodayDateString())

  const fetchCustomer = useCallback(async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/customers/${customerId}`, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      if (response.ok) {
        const data = await response.json()
        setCustomer(data.customer)
        setFormData({
          name: data.customer.name,
          phone: data.customer.phone || '',
          email: data.customer.email || '',
          address: data.customer.address || ''
        })
      } else {
        const errorData = await response.json()
        console.error('Customer not found:', errorData.error)
        alert(errorData.error || 'Customer not found')
        router.push('/customers')
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
      alert('Failed to fetch customer data')
      router.push('/customers')
    } finally {
      setLoading(false)
    }
  }, [customerId, router])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        setCustomer(data.customer)
        setEditing(false)
        alert('Customer updated successfully!')
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      alert('Failed to update customer')
    }
  }

  const handleCollectGold = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(collectAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    const pending = customer?.jamaGold?.summary?.totalJamaPending || 0
    if (amount > pending) {
      alert(`Collection amount (${amount}g) cannot exceed pending amount (${pending.toFixed(3)}g)`)
      return
    }

    setCollecting(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/customers/${customerId}/jama-gold`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          returnAmount: amount,
          description: collectDescription || `Gold collected from customer ${customer?.name}`
        })
      })

      if (response.ok) {
        alert('Gold collected successfully!')
        setShowCollectModal(false)
        setCollectAmount('')
        setCollectDescription('')
        fetchCustomer() // Refresh customer data
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to collect gold')
      }
    } catch (error) {
      console.error('Error collecting gold:', error)
      alert('Failed to collect gold')
    } finally {
      setCollecting(false)
    }
  }

  const handleManualAddGold = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(addAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setAdding(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/customers/${customerId}/jama-gold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          jamaGoldAmount: amount,
          description: addDescription || `Manual gold entry for customer ${customer?.name}`
        })
      })

      if (response.ok) {
        alert('Gold added successfully!')
        setShowAddModal(false)
        setAddAmount('')
        setAddDescription('')
        fetchCustomer() // Refresh customer data
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add gold')
      }
    } catch (error) {
      console.error('Error adding gold:', error)
      alert('Failed to add gold')
    } finally {
      setAdding(false)
    }
  }

  useEffect(() => {
    fetchCustomer()
  }, [fetchCustomer])


  const calculateSpreadsheetTotals = (ordersList: any[]) => {
    const totals = {
      fillingIn: 0,
      fillingOut: 0,
      fillingLoss: 0,
      settingLoss: 0,
      ad: 0,
      klStone: 0,
      polishLoss: 0,
      finishWeight: 0,
      makingCharge: 0,
    }

    ordersList.forEach((o) => {
      totals.fillingIn += o.fillingIn || 0
      totals.fillingOut += o.fillingOut || 0
      totals.fillingLoss += o.fillingLoss || 0
      totals.settingLoss += o.settingLoss || 0
      totals.ad += o.ad || 0
      totals.klStone += o.klStone || 0
      totals.polishLoss += o.polishLoss || 0
      totals.finishWeight += o.finishWeight || 0
      totals.makingCharge += o.makingCharge || 0
    })

    Object.keys(totals).forEach((key) => {
      const k = key as keyof typeof totals
      totals[k] = parseFloat(totals[k].toFixed(3))
    })

    return totals
  }

  const getFilteredOrders = () => {
    if (!customer) return []

    return customer.orders.filter(order => {
      const matchesSearch = searchTerm === '' ||
        (order.orderName && order.orderName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter

      return matchesSearch && matchesStatus
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROCESS': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'DELIVERED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  const filteredOrders = getFilteredOrders()

  if (!customer) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-gray-500 text-lg">Loading customer...</div></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/customers" className="text-blue-600 hover:text-blue-800">
            ← Back to Customers
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
        </div>
        <Link
          href={`/orders/new?customerId=${customerId}`}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          New Order
        </Link>
      </div>

      {/* Customer Information */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Customer Information</h2>
          <div className="flex space-x-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => setEditing(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Name</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">{customer.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Phone</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {customer.phone || 'Not provided'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Email</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {customer.email || 'Not provided'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Address</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {customer.address || 'Not provided'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Customer Since</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Jama Gold Balance Summary */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Jama Gold Balance Summary</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow"
            >
              Add Gold Manually
            </button>
            {customer.jamaGold?.summary?.totalJamaPending && customer.jamaGold.summary.totalJamaPending > 0 ? (
              <button
                onClick={() => setShowCollectModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium shadow"
              >
                Collect / Recover Gold
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 className="text-sm font-medium text-blue-800">Total Gold Owed (Jama)</h3>
            <p className="mt-2 text-3xl font-bold text-blue-900">
              {(customer.jamaGold?.summary?.totalJamaGold || 0).toFixed(3)}g
            </p>
            <p className="text-xs text-blue-600 mt-1">Total gold billed to customer</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <h3 className="text-sm font-medium text-green-800">Total Gold Recovered</h3>
            <p className="mt-2 text-3xl font-bold text-green-900">
              {(customer.jamaGold?.summary?.totalJamaReturned || 0).toFixed(3)}g
            </p>
            <p className="text-xs text-green-600 mt-1">Gold returned/collected so far</p>
          </div>

          <div className={`p-4 rounded-lg border ${customer.jamaGold?.summary?.totalJamaPending && customer.jamaGold.summary.totalJamaPending > 0
            ? 'bg-red-50 border-red-100'
            : 'bg-gray-50 border-gray-100'
            }`}>
            <h3 className={`text-sm font-medium ${customer.jamaGold?.summary?.totalJamaPending && customer.jamaGold.summary.totalJamaPending > 0
              ? 'text-red-800'
              : 'text-gray-800'
              }`}>Net Pending Gold</h3>
            <p className={`mt-2 text-3xl font-bold ${customer.jamaGold?.summary?.totalJamaPending && customer.jamaGold.summary.totalJamaPending > 0
              ? 'text-red-900'
              : 'text-gray-900'
              }`}>
              {(customer.jamaGold?.summary?.totalJamaPending || 0).toFixed(3)}g
            </p>
            <p className={`text-xs mt-1 ${customer.jamaGold?.summary?.totalJamaPending && customer.jamaGold.summary.totalJamaPending > 0
              ? 'text-red-600'
              : 'text-gray-600'
              }`}>Remaining gold to be collected</p>
          </div>
        </div>
      </div>

      {/* Daily Jama & Recovery Report */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Daily Jama & Recovery Report</h2>
            <p className="text-sm text-gray-500 mt-1">Filter total gold jama and recovery by date</p>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Select Date:</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {(() => {
          const dayTransactions = (customer.transactions || []).filter((tx: any) => {
            const txDate = new Date(tx.createdAt)
            const year = txDate.getFullYear()
            const month = String(txDate.getMonth() + 1).padStart(2, '0')
            const day = String(txDate.getDate()).padStart(2, '0')
            const txDateString = `${year}-${month}-${day}`
            return txDateString === reportDate
          })

          const dailyJama = dayTransactions
            .filter((tx: any) => tx.type === 'JAMA_GOLD_ADDED')
            .reduce((sum: number, tx: any) => sum + tx.amount, 0)

          const dailyRecovered = dayTransactions
            .filter((tx: any) => tx.type === 'JAMA_GOLD_RETURNED')
            .reduce((sum: number, tx: any) => sum + tx.amount, 0)

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 text-center">
                  <h3 className="text-lg font-semibold text-blue-800">Total Gold Jama (Owed)</h3>
                  <p className="mt-2 text-4xl font-bold text-blue-900">
                    {dailyJama.toFixed(3)}g
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Gold billed/added on {new Date(reportDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border border-green-100 text-center">
                  <h3 className="text-lg font-semibold text-green-800">Total Gold Recovered</h3>
                  <p className="mt-2 text-4xl font-bold text-green-900">
                    {dailyRecovered.toFixed(3)}g
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    Gold returned/collected on {new Date(reportDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {dayTransactions.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Transactions on this day:</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-100 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dayTransactions.map((tx: any) => (
                          <tr key={tx.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                              {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.type === 'JAMA_GOLD_ADDED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                                }`}>
                                {tx.type === 'JAMA_GOLD_ADDED' ? 'Jama' : 'Recovered'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {tx.description}
                            </td>
                            <td className={`px-4 py-2 text-right text-sm font-semibold ${tx.type === 'JAMA_GOLD_ADDED' ? 'text-blue-600' : 'text-green-600'
                              }`}>
                              {tx.type === 'JAMA_GOLD_ADDED' ? '+' : '-'}{tx.amount.toFixed(3)}g
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-500 text-sm">
                  No transactions recorded on {new Date(reportDate).toLocaleDateString()}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by order name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="CREATED">Created</option>
              <option value="IN_PROCESS">In Process</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELIVERED">Delivered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Spreadsheet Order History Table (Static / Read-Only) */}
      <div className="production-register-page bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col p-4 space-y-4">
        <div className="px-2 py-1 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Order History ({filteredOrders.length})</h2>
            <p className="text-xs text-text-muted mt-1">View all bag registers, weight details, and loss totals</p>
          </div>
        </div>

        <RegisterDataTable
          orders={filteredOrders}
          totals={calculateSpreadsheetTotals(filteredOrders)}
          onEditCell={() => { }}
          onDeleteRow={() => { }}
          onImageClick={(url) => setPreviewImage(url)}
          onPhotoUpload={() => { }}
          onSaveRow={() => { }}
          onCreateBill={() => { }}
          page={1}
          limit={filteredOrders.length || 10}
          readOnly={true}
        />
      </div>

      {/* Image Preview Overlay */}
      {previewImage && (
        <div className="production-register-page">
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
        </div>
      )}

      {/* Collect Gold Modal */}
      {showCollectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-6 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Collect / Recover Gold</h3>
              <button
                onClick={() => {
                  setShowCollectModal(false)
                  setCollectAmount('')
                  setCollectDescription('')
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCollectGold} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pending Amount: <strong>{(customer.jamaGold?.summary?.totalJamaPending || 0).toFixed(3)}g</strong>
                </label>
                <div className="relative rounded-md shadow-sm">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={customer.jamaGold?.summary?.totalJamaPending || 0}
                    required
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    placeholder="Enter amount in grams"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">g</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={collectDescription}
                  onChange={(e) => setCollectDescription(e.target.value)}
                  placeholder="e.g., Customer returned 20g gold in cash/bar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={collecting}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white px-4 py-2 rounded-md font-medium text-center"
                >
                  {collecting ? 'Processing...' : 'Submit Collection'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCollectModal(false)
                    setCollectAmount('')
                    setCollectDescription('')
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium text-center"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Gold Manually Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-6 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Gold Manually (Jama)</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setAddAmount('')
                  setAddDescription('')
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleManualAddGold} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gold Amount (grams) *
                </label>
                <div className="relative rounded-md shadow-sm">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="Enter amount in grams"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">g</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  placeholder="e.g., Customer deposited 10g gold bar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md font-medium text-center"
                >
                  {adding ? 'Processing...' : 'Add Gold'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setAddAmount('')
                    setAddDescription('')
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium text-center"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerDetailPage
