'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  businessName: string
  phone?: string
  role?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (userData: {
    email: string
    password: string
    firstName: string
    lastName: string
    businessName: string
    phone?: string
  }) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateProfile: (userData: Partial<User>) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Get stored session token
  const getSessionToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sessionToken')
    }
    return null
  }

  // Store session token
  const setSessionToken = (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sessionToken', token)
    }
  }

  // Remove session token
  const removeSessionToken = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sessionToken')
    }
  }

  // Check if user is logged in on app start
  useEffect(() => {
    const checkAuth = async () => {
      const token = getSessionToken()
      if (token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              setUser(data.data.user)
            } else {
              // Invalid response format, remove token
              removeSessionToken()
            }
          } else {
            // Invalid token, remove it
            removeSessionToken()
          }
        } catch (error) {
          console.error('Auth check failed:', error)
          removeSessionToken()
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setUser(data.data.user)
        setSessionToken(data.data.accessToken) // Store JWT access token
        
        // Store refresh token separately if needed
        if (typeof window !== 'undefined' && data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken)
        }
        
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Network error occurred' }
    }
  }

  const register = async (userData: {
    email: string
    password: string
    firstName: string
    lastName: string
    businessName: string
    phone?: string
  }) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...userData,
          organizationName: userData.businessName // Map businessName to organizationName
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Auto-login after successful registration
        setUser(data.data.user)
        setSessionToken(data.data.accessToken)
        
        // Store refresh token
        if (typeof window !== 'undefined' && data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken)
        }
        
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Registration failed' }
      }
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, error: 'Network error occurred' }
    }
  }

  const logout = async () => {
    try {
      const token = getSessionToken()
      if (token) {
        await fetch('/api/auth/logout', { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      removeSessionToken()
      // Also remove refresh token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refreshToken')
      }
    }
  }

  const updateProfile = async (userData: Partial<User>) => {
    try {
      const token = getSessionToken()
      if (!token) {
        return { success: false, error: 'Not authenticated' }
      }

      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setUser(data.data.user)
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Update failed' }
      }
    } catch (error) {
      console.error('Update profile error:', error)
      return { success: false, error: 'Network error occurred' }
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
