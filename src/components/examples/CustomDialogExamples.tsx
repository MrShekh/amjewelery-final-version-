'use client'

import React from 'react'
import useCustomDialogs from '@/hooks/useCustomDialogs'

/**
 * Example component showing how to use custom dialogs throughout your system
 * This replaces ALL browser alert() and confirm() calls with beautiful custom modals
 */
const CustomDialogExamples: React.FC = () => {
  const { alert, confirm, success, error, warning, info, confirmDelete, confirmSave } = useCustomDialogs()

  // Example 1: Replace alert() with custom alert
  const handleSimpleAlert = async () => {
    await alert('Information', 'This is a custom alert message', 'info')
    console.log('Alert closed!')
  }

  // Example 2: Replace confirm() with custom confirm  
  const handleSimpleConfirm = async () => {
    const confirmed = await confirm('Confirm Action', 'Are you sure you want to proceed?')
    
    if (confirmed) {
      await success('Success!', 'You confirmed the action')
    } else {
      await info('Cancelled', 'You cancelled the action')
    }
  }

  // Example 3: Success message
  const handleSuccess = async () => {
    await success('Operation Successful', 'Your data has been saved successfully!', 'Great!')
  }

  // Example 4: Error message
  const handleError = async () => {
    await error('Operation Failed', 'Something went wrong. Please try again.')
  }

  // Example 5: Warning message
  const handleWarning = async () => {
    await warning('Warning!', 'This action cannot be undone.')
  }

  // Example 6: Delete confirmation
  const handleDelete = async () => {
    const confirmed = await confirmDelete('customer')
    
    if (confirmed) {
      await success('Deleted!', 'Customer has been deleted successfully')
    }
  }

  // Example 7: Save confirmation
  const handleSave = async () => {
    const shouldSave = await confirmSave()
    
    if (shouldSave) {
      await success('Saved!', 'Your changes have been saved')
    } else {
      await info('Not Saved', 'Changes were discarded')
    }
  }

  // Example 8: Custom confirmation with custom buttons
  const handleCustomConfirm = async () => {
    const confirmed = await confirm(
      'Update Inventory', 
      'This will update all inventory levels. Continue?',
      'warning',
      'Update Now',
      'Keep Current'
    )
    
    if (confirmed) {
      await success('Updated!', 'Inventory has been updated')
    }
  }

  // Example 9: Form validation errors
  const handleFormSubmit = async () => {
    const name = ''
    const email = 'invalid-email'
    
    if (!name) {
      await error('Validation Error', 'Name is required')
      return
    }
    
    if (!email.includes('@')) {
      await error('Invalid Email', 'Please enter a valid email address')
      return
    }
    
    await success('Form Submitted', 'Form has been submitted successfully!')
  }

  // Example 10: API error handling
  const handleApiCall = async () => {
    try {
      // Simulating an API call that fails
      throw new Error('Network error')
    } catch (err) {
      await error('Connection Error', 'Failed to connect to server. Please check your internet connection and try again.')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Custom Dialog Examples</h1>
      <p className="text-gray-600 mb-6">
        These examples show how to replace ALL alert() and confirm() calls in your system with beautiful custom modals.
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <button
          onClick={handleSimpleAlert}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Simple Alert
        </button>
        
        <button
          onClick={handleSimpleConfirm}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md"
        >
          Simple Confirm
        </button>
        
        <button
          onClick={handleSuccess}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          Success Message
        </button>
        
        <button
          onClick={handleError}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
        >
          Error Message
        </button>
        
        <button
          onClick={handleWarning}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md"
        >
          Warning Message
        </button>
        
        <button
          onClick={handleDelete}
          className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md"
        >
          Delete Confirm
        </button>
        
        <button
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
        >
          Save Confirm
        </button>
        
        <button
          onClick={handleCustomConfirm}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md"
        >
          Custom Confirm
        </button>
        
        <button
          onClick={handleFormSubmit}
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-md"
        >
          Form Validation
        </button>
        
        <button
          onClick={handleApiCall}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
        >
          API Error
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Usage Instructions:</h2>
        <div className="text-sm text-gray-700 space-y-2">
          <p><strong>1.</strong> Import the hook: <code className="bg-gray-200 px-1 rounded">import useCustomDialogs from '@/hooks/useCustomDialogs'</code></p>
          <p><strong>2.</strong> Use in component: <code className="bg-gray-200 px-1 rounded">const {`{ alert, confirm, success, error }`} = useCustomDialogs()</code></p>
          <p><strong>3.</strong> Replace all alert(): <code className="bg-gray-200 px-1 rounded">await alert('Title', 'Message')</code></p>
          <p><strong>4.</strong> Replace all confirm(): <code className="bg-gray-200 px-1 rounded">const confirmed = await confirm('Title', 'Message')</code></p>
        </div>
      </div>
    </div>
  )
}

export default CustomDialogExamples
