'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

const Navigation = () => {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)

  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-700' : 'hover:bg-blue-700'
  }

  const handleLogout = () => {
    logout()
    setShowDropdown(false)
  }

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold flex items-center">
              <span className="mr-2">🏪</span>
              {user?.businessName || 'AM Jewellers'}
            </Link>

            <div className="hidden md:flex space-x-4">
              <Link
                href="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/')}`}
              >
                Dashboard
              </Link>
              <Link
                href="/customers"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/customers')}`}
              >
                Customers
              </Link>
              <Link
                href="/orders"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/orders')}`}
              >
                Orders
              </Link>
              <Link
                href="/production-register"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/production-register')}`}
              >
                Order Register
              </Link>
              <Link
                href="/analytics"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/analytics')}`}
              >
                Analytics
              </Link>
              <Link
                href="/manager"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/manager')}`}
              >
                Ezaz Ahmad
              </Link>
              <Link
                href="/bills"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/bills')}`}
              >
                Bills
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4 relative">

            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 text-sm hover:bg-blue-700 px-3 py-2 rounded-md"
              >
                <span>👤</span>
                <span className="hidden sm:inline">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs">▼</span>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 text-xs text-gray-500 border-b">
                    {user?.email}
                  </div>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowDropdown(false)}
                  >
                    Profile Settings
                  </Link>
                  <div className="border-t">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation
