'use client'

import { ReactNode } from 'react'

interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string | ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  type?: 'info' | 'warning' | 'error' | 'success'
  isLoading?: boolean
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'info',
  isLoading = false
}) => {
  if (!isOpen) return null

  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          icon: '⚠️',
          headerBg: 'bg-yellow-50',
          headerText: 'text-yellow-900',
          confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400'
        }
      case 'error':
        return {
          icon: '❌',
          headerBg: 'bg-red-50',
          headerText: 'text-red-900',
          confirmBtn: 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
        }
      case 'success':
        return {
          icon: '✅',
          headerBg: 'bg-green-50',
          headerText: 'text-green-900',
          confirmBtn: 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
        }
      default:
        return {
          icon: 'ℹ️',
          headerBg: 'bg-blue-50',
          headerText: 'text-blue-900',
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
        }
    }
  }

  const styles = getTypeStyles()

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className={`flex items-center p-4 rounded-t-md ${styles.headerBg} mb-4`}>
            <span className="text-2xl mr-3">{styles.icon}</span>
            <h3 className={`text-lg font-medium ${styles.headerText}`}>
              {title}
            </h3>
          </div>

          {/* Message */}
          <div className="mb-6">
            {typeof message === 'string' ? (
              <div className="text-sm text-gray-700 whitespace-pre-line">
                {message}
              </div>
            ) : (
              <div className="text-sm text-gray-700">
                {message}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`text-white px-4 py-2 rounded-md font-medium ${styles.confirmBtn}`}
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
