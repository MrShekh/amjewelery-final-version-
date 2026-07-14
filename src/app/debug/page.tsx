'use client'

import { useState } from 'react'

export default function DebugPage() {
  const [apiResponse, setApiResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testOrdersAPI = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('sessionToken')
      console.log('Testing with token:', token ? 'exists' : 'missing')
      
      const response = await fetch('/api/orders', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      
      const data = await response.json()
      console.log('Response data:', data)
      
      setApiResponse({
        status: response.status,
        ok: response.ok,
        data: data,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('API test error:', error)
      setApiResponse({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const testCustomersAPI = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('sessionToken')
      
      const response = await fetch('/api/customers', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      
      const data = await response.json()
      
      setApiResponse({
        status: response.status,
        ok: response.ok,
        data: data,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('API test error:', error)
      setApiResponse({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const checkAuthStatus = () => {
    const token = localStorage.getItem('sessionToken')
    const refreshToken = localStorage.getItem('refreshToken')
    
    setApiResponse({
      tokenExists: !!token,
      tokenValue: token ? `${token.substring(0, 20)}...` : null,
      refreshTokenExists: !!refreshToken,
      localStorage: Object.keys(localStorage),
      timestamp: new Date().toISOString()
    })
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">API Debug Page</h1>
      
      <div className="space-y-4 mb-6">
        <button 
          onClick={checkAuthStatus}
          className="bg-blue-600 text-white px-4 py-2 rounded mr-4"
        >
          Check Auth Status
        </button>
        
        <button 
          onClick={testOrdersAPI}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded mr-4 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Orders API'}
        </button>
        
        <button 
          onClick={testCustomersAPI}
          disabled={loading}
          className="bg-purple-600 text-white px-4 py-2 rounded mr-4 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Customers API'}
        </button>
      </div>

      {apiResponse && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">API Response</h2>
          <pre className="bg-white p-4 rounded border overflow-auto text-sm">
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>First, click "Check Auth Status" to verify your authentication</li>
          <li>Then click "Test Orders API" to see what the orders endpoint returns</li>
          <li>Check the browser console for detailed logs</li>
          <li>Compare with "Test Customers API" to see if the issue is specific to orders</li>
        </ol>
      </div>
    </div>
  )
}
