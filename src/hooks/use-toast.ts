import { useState, useCallback } from 'react'

interface Toast {
  id?: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

interface UseToastReturn {
  toast: (toast: Toast) => void
  toasts: Toast[]
  dismiss: (id?: string) => void
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((newToast: Toast) => {
    const id = Math.random().toString(36).substr(2, 9)
    const toastWithId = { ...newToast, id }
    
    setToasts(prev => [...prev, toastWithId])
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      dismiss(id)
    }, 5000)
  }, [])

  const dismiss = useCallback((id?: string) => {
    if (id) {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    } else {
      setToasts([])
    }
  }, [])

  return {
    toast,
    toasts,
    dismiss
  }
}
