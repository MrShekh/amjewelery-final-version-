'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import ConfirmationModal from '@/components/ConfirmationModal'
import AlertModal from '@/components/AlertModal'

interface ModalContextType {
  showAlert: (title: string, message: string, type?: 'info' | 'warning' | 'error' | 'success', buttonText?: string) => Promise<void>
  showConfirm: (title: string, message: string, type?: 'info' | 'warning' | 'error' | 'success', confirmText?: string, cancelText?: string) => Promise<boolean>
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

interface ModalProviderProps {
  children: ReactNode
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  // Alert modal state
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'error' | 'success',
    buttonText: 'OK',
    resolve: null as ((value: void) => void) | null
  })

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning' as 'info' | 'warning' | 'error' | 'success',
    confirmText: 'Yes',
    cancelText: 'Cancel',
    resolve: null as ((value: boolean) => void) | null
  })

  const showAlert = (
    title: string, 
    message: string, 
    type: 'info' | 'warning' | 'error' | 'success' = 'info', 
    buttonText: string = 'OK'
  ): Promise<void> => {
    return new Promise((resolve) => {
      setAlertModal({
        isOpen: true,
        title,
        message,
        type,
        buttonText,
        resolve
      })
    })
  }

  const showConfirm = (
    title: string, 
    message: string, 
    type: 'info' | 'warning' | 'error' | 'success' = 'warning',
    confirmText: string = 'Yes',
    cancelText: string = 'Cancel'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        title,
        message,
        type,
        confirmText,
        cancelText,
        resolve
      })
    })
  }

  const closeAlert = () => {
    if (alertModal.resolve) {
      alertModal.resolve()
    }
    setAlertModal({
      isOpen: false,
      title: '',
      message: '',
      type: 'info',
      buttonText: 'OK',
      resolve: null
    })
  }

  const closeConfirm = (result: boolean) => {
    if (confirmModal.resolve) {
      confirmModal.resolve(result)
    }
    setConfirmModal({
      isOpen: false,
      title: '',
      message: '',
      type: 'warning',
      confirmText: 'Yes',
      cancelText: 'Cancel',
      resolve: null
    })
  }

  const contextValue: ModalContextType = {
    showAlert,
    showConfirm
  }

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      
      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        buttonText={alertModal.buttonText}
        onClose={closeAlert}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
    </ModalContext.Provider>
  )
}

// Custom hook to use the modal context
export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

// Helper functions that can be used anywhere in the app
export const useAlert = () => {
  const { showAlert } = useModal()
  return showAlert
}

export const useConfirm = () => {
  const { showConfirm } = useModal()
  return showConfirm
}
