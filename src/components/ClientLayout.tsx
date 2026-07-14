'use client'

import { useAuth } from '@/contexts/AuthContext'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Navigation from '@/components/Navigation'

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register']
  const isPublicRoute = publicRoutes.includes(pathname)

  useEffect(() => {
    if (!loading) {
      // If user is not logged in and trying to access protected route
      if (!user && !isPublicRoute) {
        router.push('/login')
        return
      }
      
      // If user is logged in and trying to access auth pages, redirect to dashboard
      if (user && isPublicRoute) {
        router.push('/')
        return
      }
    }
  }, [user, loading, isPublicRoute, router])

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // For public routes (login/register), show without navigation
  if (isPublicRoute) {
    return <>{children}</>
  }

  // For protected routes, show with navigation
  if (user) {
    return (
      <>
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </>
    )
  }

  // This should not happen due to useEffect redirect, but just in case
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600 mb-4">Please log in to access this page.</p>
        <button
          onClick={() => router.push('/login')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    </div>
  )
}
