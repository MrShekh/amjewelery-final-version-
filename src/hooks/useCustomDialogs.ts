import { useModal } from '@/contexts/ModalContext'

/**
 * Custom hook that provides alert and confirm functions to replace browser dialogs
 * Usage:
 * 
 * const { alert: customAlert, confirm: customConfirm } = useCustomDialogs()
 * 
 * await customAlert('Title', 'Message') // Replaces alert()
 * const result = await customConfirm('Title', 'Message') // Replaces confirm()
 */
export const useCustomDialogs = () => {
  const { showAlert, showConfirm } = useModal()

  /**
   * Custom alert function that replaces browser alert()
   * @param title - Alert title
   * @param message - Alert message  
   * @param type - Alert type (info, warning, error, success)
   * @param buttonText - Custom button text (default: 'OK')
   */
  const alert = async (
    title: string, 
    message: string, 
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
    buttonText: string = 'OK'
  ): Promise<void> => {
    return await showAlert(title, message, type, buttonText)
  }

  /**
   * Custom confirm function that replaces browser confirm()
   * @param title - Confirmation title
   * @param message - Confirmation message
   * @param type - Confirmation type (info, warning, error, success) 
   * @param confirmText - Custom confirm button text (default: 'Yes')
   * @param cancelText - Custom cancel button text (default: 'Cancel')
   * @returns Promise<boolean> - true if confirmed, false if cancelled
   */
  const confirm = async (
    title: string, 
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'warning',
    confirmText: string = 'Yes',
    cancelText: string = 'Cancel'
  ): Promise<boolean> => {
    return await showConfirm(title, message, type, confirmText, cancelText)
  }

  /**
   * Convenience methods with preset types
   */
  const success = async (title: string, message: string, buttonText: string = 'OK') => {
    return await showAlert(title, message, 'success', buttonText)
  }

  const error = async (title: string, message: string, buttonText: string = 'OK') => {
    return await showAlert(title, message, 'error', buttonText)
  }

  const warning = async (title: string, message: string, buttonText: string = 'OK') => {
    return await showAlert(title, message, 'warning', buttonText)
  }

  const info = async (title: string, message: string, buttonText: string = 'OK') => {
    return await showAlert(title, message, 'info', buttonText)
  }

  const confirmDelete = async (itemName: string = 'item') => {
    return await showConfirm(
      'Confirm Deletion',
      `Are you sure you want to delete this ${itemName}? This action cannot be undone.`,
      'error',
      'Delete',
      'Cancel'
    )
  }

  const confirmSave = async () => {
    return await showConfirm(
      'Save Changes',
      'Do you want to save the changes you made?',
      'info',
      'Save',
      'Don\'t Save'
    )
  }

  const confirmProcessAction = async (action: string, details: string) => {
    return await showConfirm(
      `Confirm ${action}`,
      `Are you sure you want to ${action.toLowerCase()}?\n\n${details}`,
      'warning',
      'OK',
      'Cancel'
    )
  }

  const confirmWeightUpdate = async (currentWeight: number, additionalWeight: number, description: string) => {
    return await showConfirm(
      'Confirm Weight Update',
      `Add ${additionalWeight.toFixed(3)}g extra weight?\n\nCurrent: ${currentWeight.toFixed(3)}g\nAdditional: +${additionalWeight.toFixed(3)}g\nNew Total: ${(currentWeight + additionalWeight).toFixed(3)}g\n\nReason: ${description}`,
      'warning',
      'OK',
      'Cancel'
    )
  }

  return {
    // Main functions
    alert,
    confirm,
    
    // Convenience methods
    success,
    error,
    warning,
    info,
    confirmDelete,
    confirmSave,
    confirmProcessAction,
    confirmWeightUpdate,
    
    // Direct access to context functions
    showAlert,
    showConfirm
  }
}

export default useCustomDialogs
