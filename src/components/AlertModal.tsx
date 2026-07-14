'use client'

import { ReactNode } from 'react'

interface AlertModalProps {
  isOpen: boolean
  title: string
  message: string | ReactNode
  buttonText?: string
  onClose: () => void
  type?: 'info' | 'warning' | 'error' | 'success'
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  buttonText = 'OK',
  onClose,
  type = 'info'
}) => {
  if (!isOpen) return null

  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          icon: '⚠️',
          headerBg: 'bg-yellow-50',
          headerText: 'text-yellow-900',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        }
      case 'error':
        return {
          icon: '❌',
          headerBg: 'bg-red-50',
          headerText: 'text-red-900',
          button: 'bg-red-600 hover:bg-red-700'
        }
      case 'success':
        return {
          icon: '✅',
          headerBg: 'bg-green-50',
          headerText: 'text-green-900',
          button: 'bg-green-600 hover:bg-green-700'
        }
      default:
        return {
          icon: 'ℹ️',
          headerBg: 'bg-blue-50',
          headerText: 'text-blue-900',
          button: 'bg-blue-600 hover:bg-blue-700'
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

          {/* Button */}
          <div className="flex items-center justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className={`text-white px-6 py-2 rounded-md font-medium ${styles.button}`}
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlertModal
