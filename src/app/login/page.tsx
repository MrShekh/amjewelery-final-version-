'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [stockForm, setStockForm] = useState({
    currentStock: ''
  })
  const [loading, setLoading] = useState(false)
  const [stockLoading, setStockLoading] = useState(false)
  const [error, setError] = useState('')
  const [showStockEntry, setShowStockEntry] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await login(formData.email, formData.password)
    
    if (result.success) {
      setShowStockEntry(true) // Show stock entry instead of redirecting
    } else {
      setError(result.error || 'Login failed')
    }
    
    setLoading(false)
  }

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStockLoading(true)
    setError('')

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/inventory/admin-stock', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          adminStock: parseFloat(stockForm.currentStock)
        }),
      })

      if (response.ok) {
        router.push('/') // Now redirect to dashboard
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update stock')
      }
    } catch (error) {
      console.error('Stock update error:', error)
      setError('Network error occurred')
    }

    setStockLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStockForm({
      ...stockForm,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">🏪 AM Jewellers</h1>
          <p className="mt-2 text-gray-600">Gold ERP System</p>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          {showStockEntry ? 'Update Admin Gold Stock' : 'Sign in to your account'}
        </h2>
        {!showStockEntry && (
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              create a new account
            </Link>
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {!showStockEntry ? (
            // Login Form
            <>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="text-red-800 text-sm">{error}</div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Test Accounts</span>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded">
                <p><strong>Demo Login:</strong></p>
                <p>Email: admin@amjewellers.com</p>
                <p>Password: admin123</p>
                <p className="mt-2 text-gray-400">Note: Passwords are stored in plain text in database as requested</p>
              </div>
            </div>
            </>
          ) : (
            // Stock Entry Form
            <form className="space-y-6" onSubmit={handleStockSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="text-red-800 text-sm">{error}</div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="text-blue-800 text-sm">
                  <p className="font-medium">📝 Admin Stock Entry Required</p>
                  <p className="mt-1">Please enter your current gold stock to continue. This will update your admin inventory.</p>
                </div>
              </div>

              <div>
                <label htmlFor="currentStock" className="block text-sm font-medium text-gray-700">
                  Current Admin Gold Stock (grams)
                </label>
                <div className="mt-1">
                  <input
                    id="currentStock"
                    name="currentStock"
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={stockForm.currentStock}
                    onChange={handleStockChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter current stock in grams"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={stockLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {stockLoading ? 'Updating Stock...' : 'Update Stock & Continue'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
