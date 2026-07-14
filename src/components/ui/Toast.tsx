'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: ToastMessage['type'], duration?: number) => void
  hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

const toastStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800'
}

const toastIcons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
}

interface ToastItemProps {
  toast: ToastMessage
  onHide: (id: string) => void
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onHide }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onHide(toast.id)
    }, toast.duration || 5000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onHide])

  return (
    <div
      className={`
        flex items-center p-4 mb-3 border rounded-lg shadow-md transition-all duration-300 
        ${toastStyles[toast.type]}
        animate-slide-in-right
      `}
    >
      <span className="text-lg mr-3">{toastIcons[toast.type]}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
      <button
        onClick={() => onHide(toast.id)}
        className="ml-3 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <span className="text-lg">×</span>
      </button>
    </div>
  )
}

interface ToastProviderProps {
  children: React.ReactNode
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((
    message: string,
    type: ToastMessage['type'] = 'info',
    duration = 5000
  ) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: ToastMessage = {
      id,
      message,
      type,
      duration
    }

    setToasts(prev => [...prev, newToast])
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 w-80 max-w-sm">
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onHide={hideToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Utility functions for quick toast calls
export const toast = {
  success: (message: string, duration?: number) => {
    // This will be properly implemented when the provider is available
    console.log('✅ Success:', message)
  },
  error: (message: string, duration?: number) => {
    console.log('❌ Error:', message)
  },
  warning: (message: string, duration?: number) => {
    console.log('⚠️ Warning:', message)
  },
  info: (message: string, duration?: number) => {
    console.log('ℹ️ Info:', message)
  }
}

// Add CSS for slide-in animation
const toastStyles_CSS = `
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }
`

// Inject styles (you might want to add this to your global CSS instead)
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = toastStyles_CSS
  document.head.appendChild(styleElement)
}
