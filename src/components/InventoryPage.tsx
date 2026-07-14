'use client'

import { useEffect, useState } from 'react'
import type { KaratPurity } from '@/lib/gold-conversions'

interface InventoryData {
  inventory: {
    id: string
    adminStock: number
    karigarLossStock?: number
    customerStock: number
    advanceCustomerStock?: number // Customer advance gold for orders
    lastUpdated: string
    createdAt: string
  }
  summary: {
    currentStock: number
    adminStock: number
    karigarLossStock?: number
    customerStock: number
    totalStock: number
    totalIn: number
    totalOut: number
    totalLoss: number
    karigarLoss: number
    castingLoss: number
    totalRecovery: number
    totalManufacturingCost: number
    netLoss: number
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

const InventoryPage = () => {
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showExtraStockModal, setShowExtraStockModal] = useState(false) // legacy, unused
  const [passwordForm, setPasswordForm] = useState({ password: '' })
  const [verificationToken, setVerificationToken] = useState('')
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustment: '',
    reason: '',
    inventoryType: 'admin'
  })
  const [extraStockForm, setExtraStockForm] = useState<{
    karatType: KaratPurity,
    karatAmount: string
  }>({
    karatType: 92,
    karatAmount: ''
  })

  useEffect(() => {
    fetchInventoryData()
  }, [])

  const fetchInventoryData = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/inventory', {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      const data = await response.json()
      
      if (response.ok) {
        // Handle new API response format
        if (data.success) {
          setInventoryData(data.data)
        } else {
          setInventoryData(data) // Fallback for old format
        }
      } else {
        console.error('Failed to fetch inventory:', data.error)
        alert(data.error || 'Failed to fetch inventory data')
      }
    } catch (error) {
      console.error('Error fetching inventory:', error)
      alert('Network error while fetching inventory')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          password: passwordForm.password
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setVerificationToken(data.verificationToken)
        setShowPasswordModal(false)
        setPasswordForm({ password: '' })
        // Now proceed with the actual adjustment
        await performAdjustment(data.verificationToken)
      } else {
        alert(data.error || 'Password verification failed')
      }
    } catch (error) {
      console.error('Error verifying password:', error)
      alert('Failed to verify admin password')
    }
  }

  const performAdjustment = async (token?: string) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const body: any = {
        ...adjustmentForm,
        adjustment: parseFloat(adjustmentForm.adjustment as string) || 0
      }

      // Add verification token for admin stock adjustments
      if (adjustmentForm.inventoryType === 'admin' && (token || verificationToken)) {
        body.adminVerificationToken = token || verificationToken
      }

      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        setShowAdjustmentModal(false)
        setAdjustmentForm({ adjustment: '', reason: '', inventoryType: 'admin' })
        setVerificationToken('')
        fetchInventoryData()
        alert('Stock adjusted successfully!')
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Error adjusting inventory:', error)
      alert('Failed to adjust inventory')
    }
  }

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if this is an admin stock adjustment
    if (adjustmentForm.inventoryType === 'admin') {
      // Show password modal for admin stock adjustments
      setShowPasswordModal(true)
    } else {
      // For non-admin stock adjustments, proceed directly
      await performAdjustment()
    }
  }

  const handleAddExtraStock = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/inventory/add-extra-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          karatType: extraStockForm.karatType,
          karatAmount: parseFloat(extraStockForm.karatAmount)
        })
      })
      
      const data = await response.json()
      if (response.ok) {
        alert(data.message)
        setShowExtraStockModal(false)
        setExtraStockForm({ karatType: 92 as KaratPurity, karatAmount: '' })
        await fetchInventoryData() // Refresh data
      } else {
        alert(data.error || 'Failed to add extra stock')
      }
    } catch (error) {
      console.error('Error adding extra stock:', error)
      alert('Failed to add extra stock')
    }
  }

  const openExtraStockModal = (karatType: KaratPurity) => {
    setExtraStockForm({ karatType, karatAmount: '' })
    setShowExtraStockModal(true)
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'GOLD_IN':
      case 'GOLD_RECOVERY':
      case 'MANUFACTURING_COST':
        return 'text-green-600'
      case 'GOLD_OUT':
      case 'GOLD_LOSS':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getTransactionSign = (type: string) => {
    switch (type) {
      case 'GOLD_IN':
      case 'GOLD_RECOVERY':
      case 'MANUFACTURING_COST':
        return '+'
      case 'GOLD_OUT':
      case 'GOLD_LOSS':
        return '-'
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!inventoryData) {
    return <div>Failed to load inventory data</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gold Inventory</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setAdjustmentForm({ adjustment: '', reason: '', inventoryType: 'admin' })
              setShowAdjustmentModal(true)
            }}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
          >
            🔒 Update Admin Stock
          </button>
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Adjust Other Stock
          </button>
        </div>
      </div>

      {/* Stock Inventory Cards - simplified: Total, Admin, Karigar Loss, Customer */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Stock */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-lg text-white">
          <h2 className="text-lg font-semibold mb-2">Total Stock</h2>
          <p className="text-3xl font-bold">{inventoryData.summary?.currentStock?.toFixed(3) || '0.000'}g</p>
          <p className="text-green-100 mt-2 text-sm">
            Admin + Karigar Loss + Customer
          </p>
        </div>
        
        {/* Admin Gold Stock */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 p-6 rounded-lg text-white">
          <h2 className="text-lg font-semibold mb-2">Admin Stock</h2>
          <p className="text-3xl font-bold">{inventoryData.inventory?.adminStock?.toFixed(3) || '0.000'}g</p>
          <p className="text-yellow-100 mt-2 text-sm">
            Gold remaining with admin (after loss)
          </p>
        </div>
        
        {/* Karigar Loss Stock */}
        <div className="bg-gradient-to-r from-blue-400 to-blue-600 p-6 rounded-lg text-white">
          <h2 className="text-lg font-semibold mb-2">Karigar Loss Stock</h2>
          <p className="text-3xl font-bold">{(inventoryData.inventory?.karigarLossStock ?? 0).toFixed(3)}g</p>
          <p className="text-blue-100 mt-2 text-sm">
            Total loss accumulated in karigar work
          </p>
        </div>
        
        {/* Customer Stock */}
        <div className="bg-gradient-to-r from-orange-400 to-red-500 p-6 rounded-lg text-white">
          <h2 className="text-lg font-semibold mb-2">Customer Stock</h2>
          <p className="text-3xl font-bold">{inventoryData.inventory?.customerStock?.toFixed(3) || '0.000'}g</p>
          <p className="text-orange-100 mt-2 text-sm">
            Owed by customers
          </p>
        </div>
      </div>

      {/* Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Adjust Gold Stock</h3>
              <form onSubmit={handleAdjustment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Inventory Type *
                  </label>
                  <select
                    value={adjustmentForm.inventoryType}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, inventoryType: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="admin">Admin Stock</option>
                    <option value="karigar">Karigar Stock</option>
                    <option value="customer">Customer Stock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Adjustment Amount (grams) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={adjustmentForm.adjustment}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustment: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Use negative for reduction"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Current {adjustmentForm.inventoryType} stock: {
                      adjustmentForm.inventoryType === 'admin' 
                        ? inventoryData.inventory.adminStock.toFixed(3)
                        : adjustmentForm.inventoryType === 'karigar'
                        ? (inventoryData.inventory.karigarLossStock ?? 0).toFixed(3)
                        : inventoryData.inventory.customerStock.toFixed(3)
                    }g
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Reason for Adjustment *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={adjustmentForm.reason}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Physical count correction, Purchase, Sale, etc."
                  />
                </div>
                <div className="flex items-center space-x-4 pt-4">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    Adjust Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjustmentModal(false)
                      setAdjustmentForm({ adjustment: '', reason: '', inventoryType: 'admin' })
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

      {/* Admin Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">🔐 Admin Password Required</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                <div className="text-yellow-800 text-sm">
                  <p className="font-medium">⚠️ Admin Stock Adjustment</p>
                  <p className="mt-1">Please enter your admin password to proceed with admin stock modification.</p>
                </div>
              </div>
              <form onSubmit={handlePasswordVerification} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Admin Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ password: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your admin password"
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This is a developer-set password for admin stock updates.
                  </p>
                  <p className="mt-1 text-xs text-blue-600 font-medium">
                    💡 Hint: The password is &quot;admin@123&quot;
                  </p>
                </div>
                <div className="flex items-center space-x-4 pt-4">
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    🔓 Verify Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false)
                      setPasswordForm({ password: '' })
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

export default InventoryPage
