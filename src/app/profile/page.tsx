'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface UserProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  businessName: string
  role?: string
  isActive: boolean
}

interface WhatsAppStatus {
  connected: boolean
  status: string
  phone?: string
  isReady: boolean
}

const ProfilePage = () => {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('general')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    businessName: ''
  })
  const [updating, setUpdating] = useState(false)
  
  // WhatsApp state
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setProfile(user)
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        businessName: user.businessName || ''
      })
      setLoading(false)
    }
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdating(true)

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
        alert('✅ Profile updated successfully!')
      } else {
        const error = await response.json()
        alert(`❌ ${error.error || 'Failed to update profile'}`)
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('❌ Failed to update profile')
    } finally {
      setUpdating(false)
    }
  }

  // WhatsApp functions
  const checkWhatsAppStatus = async () => {
    setWhatsappLoading(true)
    try {
      const response = await fetch('/api/whatsapp/status')
      const data = await response.json()
      setWhatsappStatus(data)
    } catch (error) {
      console.error('Error checking WhatsApp status:', error)
      setWhatsappStatus({ connected: false, status: 'error', isReady: false })
    } finally {
      setWhatsappLoading(false)
    }
  }

  const loadQRCode = () => {
    const whatsappServiceUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || 'https://whatsapp-automatic-service-production-c748.up.railway.app'
    setQrCodeUrl(`${whatsappServiceUrl}/qr`)
  }

  // Check WhatsApp status when WhatsApp tab is active
  useEffect(() => {
    if (activeTab === 'whatsapp' && !whatsappStatus) {
      checkWhatsAppStatus()
    }
  }, [activeTab])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Profile not found</h2>
        <Link href="/" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
          Go to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
            <p className="text-gray-600">Manage your account and business settings</p>
          </div>
          <Link
            href="/"
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Profile Header Card */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mr-6">
              <span className="text-2xl font-bold text-blue-600">
                {profile.firstName.charAt(0).toUpperCase()}{profile.lastName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {profile.firstName} {profile.lastName}
              </h2>
              <p className="text-gray-600">{profile.email}</p>
              <div className="flex items-center mt-2 space-x-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  profile.role === 'owner' 
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {profile.role === 'owner' ? '👑 Owner' : '👤 User'}
                </span>
                <span className="text-sm text-gray-500">
                  {profile.businessName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'general'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                ⚙️ General Settings
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'security'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔒 Security
              </button>
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'whatsapp'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📱 WhatsApp Setup
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* General Settings Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">General Information</h3>
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Enter phone number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={updating}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg font-medium"
                      >
                        {updating ? 'Updating...' : '💾 Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
                  
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-yellow-800">Password Management</h4>
                        <div className="mt-1 text-sm text-yellow-700">
                          <p>Password changes are currently handled by the administrator. Contact your system admin to update your password.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">🔒 Account Security</h4>
                    <div className="space-y-2 text-green-700 text-sm">
                      <p>• Your account is protected with secure authentication</p>
                      <p>• Sessions are managed securely with refresh tokens</p>
                      <p>• All API requests are authenticated and logged</p>
                      <p>• Account status: <span className="font-semibold">Active & Verified</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp Setup Tab */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📱 WhatsApp Integration</h3>
                  
                  {/* Status Display */}
                  <div className="mb-6">
                    <div className={`p-4 rounded-lg border-l-4 ${
                      whatsappStatus?.connected 
                        ? 'bg-green-50 border-green-500' 
                        : 'bg-yellow-50 border-yellow-500'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-lg">
                            {whatsappLoading ? (
                              '🔄 Checking...'
                            ) : whatsappStatus?.connected ? (
                              '✅ WhatsApp Connected'
                            ) : (
                              '⚠️ WhatsApp Not Connected'
                            )}
                          </h4>
                          <p className="text-gray-600 text-sm mt-1">
                            {whatsappLoading ? (
                              'Checking connection status...'
                            ) : whatsappStatus?.connected ? (
                              `Ready to send bills via WhatsApp${whatsappStatus.phone ? ` (${whatsappStatus.phone})` : ''}`
                            ) : (
                              'Connect your WhatsApp to automatically send bills to customers'
                            )}
                          </p>
                        </div>
                        <button
                          onClick={checkWhatsAppStatus}
                          disabled={whatsappLoading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                        >
                          {whatsappLoading ? '🔄 Checking...' : '🔄 Refresh'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Connection Instructions */}
                  {!whatsappStatus?.connected && (
                    <div className="mb-6">
                      <h4 className="font-medium mb-4">📋 How to Connect WhatsApp:</h4>
                      
                      {!qrCodeUrl ? (
                        <div className="text-center bg-gray-50 rounded-lg p-8">
                          <div className="mb-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                              <span className="text-2xl">📱</span>
                            </div>
                            <h5 className="text-lg font-medium text-gray-900 mb-2">Connect Your WhatsApp</h5>
                            <p className="text-gray-600 mb-6">Scan a QR code to link your WhatsApp for automatic bill sending</p>
                          </div>
                          <button
                            onClick={loadQRCode}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                          >
                            📱 Show QR Code to Connect
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <h5 className="font-medium mb-3 text-blue-800">Follow these steps:</h5>
                            <ol className="list-decimal list-inside space-y-2 text-blue-700 text-sm">
                              <li>Open WhatsApp on your phone</li>
                              <li>Go to Settings → Linked Devices</li>
                              <li>Tap &quot;Link a Device&quot;</li>
                              <li>Scan the QR code below</li>
                              <li>Wait for connection confirmation (refresh status after scanning)</li>
                            </ol>
                          </div>

                          {/* Embedded QR Code */}
                          <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                            <iframe
                              src={qrCodeUrl}
                              width="100%"
                              height="500"
                              frameBorder="0"
                              title="WhatsApp QR Code"
                              className="w-full"
                            />
                          </div>

                          <div className="mt-4 flex justify-center space-x-4">
                            <button
                              onClick={() => setQrCodeUrl(`${qrCodeUrl}?t=${Date.now()}`)}
                              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                              🔄 Refresh QR Code
                            </button>
                            <button
                              onClick={() => setQrCodeUrl(null)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              ✖️ Close QR Code
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Success State */}
                  {whatsappStatus?.connected && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <h4 className="text-xl font-semibold text-green-800 mb-3">
                        🎉 WhatsApp Connected Successfully!
                      </h4>
                      <p className="text-green-700 mb-4">
                        Your WhatsApp is now connected and ready to send bills to customers automatically.
                        You can now use the &quot;Send WhatsApp&quot; button from any bill detail page.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href="/bills"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          📄 Go to Bills
                        </Link>
                        <Link
                          href="/orders"
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          📦 Go to Orders
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Features Info */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-semibold mb-3 text-gray-800">✨ WhatsApp Features</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                      <div className="flex items-start space-x-2">
                        <span className="text-green-500 mt-0.5">✅</span>
                        <span>Automatically send bill PDFs to customers</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="text-green-500 mt-0.5">✅</span>
                        <span>Professional bill formatting with company branding</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="text-green-500 mt-0.5">✅</span>
                        <span>Customer phone number validation</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="text-green-500 mt-0.5">✅</span>
                        <span>Instant delivery with read receipts</span>
                      </div>
                    </div>
                  </div>

                  {/* Troubleshooting */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3 text-yellow-800">🔧 Troubleshooting</h4>
                    <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
                      <li>Make sure your phone has a stable internet connection</li>
                      <li>Keep this browser tab open while scanning the QR code</li>
                      <li>If connection fails, try refreshing the QR code</li>
                      <li>Connection usually takes 5-10 seconds after scanning</li>
                      <li>Customer numbers must be valid WhatsApp numbers</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
