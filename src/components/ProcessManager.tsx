'use client'

import { useEffect, useState } from 'react'
import useCustomDialogs from '@/hooks/useCustomDialogs'
import ProcessEditModal from './ProcessEditModal'
import Link from 'next/link'

interface Stone {
  sizeMm: number
  pieces: number
  totalWeight: number
}

interface Process {
  id: string
  processType: string
  inputWeight: number
  outputWeight?: number
  goldLoss?: number
  status: 'STARTED' | 'COMPLETED'
  startedAt: string
  completedAt?: string
  sequence: number // Process sequence number (required for ordering)
  karigar: {
    name: string
  }
  adStonesAdded?: Stone[]
  kalesStonesAdded?: Stone[]
}

interface ProcessManagerProps {
  orderId: string
  onProcessUpdate?: () => void
}

const ProcessManager: React.FC<ProcessManagerProps> = ({ orderId, onProcessUpdate }) => {
  const [processes, setProcesses] = useState<Process[]>([])
  const [karigars, setKarigars] = useState<any[]>([])
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState('')

  // Start Process Form
  const [startFormData, setStartFormData] = useState({
    karigarId: '',
    processType: '',
    inputWeight: ''
  })

  // Stone setting specific fields
  const [stoneFormData, setStoneFormData] = useState({
    adStones: [{ sizeMm: '', pieces: '', totalWeight: '' }],
    kalesStones: [{ sizeMm: '', pieces: '', totalWeight: '' }]
  })

  // Track original gold weight before adding stones
  const [originalInputWeight, setOriginalInputWeight] = useState('')

  // Complete Process Form
  const [completeFormData, setCompleteFormData] = useState({
    processId: '',
    outputWeight: ''
  })

  // Update Input Weight Form - Enhanced with detailed breakdown
  const [updateFormData, setUpdateFormData] = useState({
    processId: '',
    currentWeight: 0,
    additionalWeight: '',
    newInputWeight: 0,
    description: '',
    isOpen: false
  })

  // Process Edit Modal State
  const [editProcessModal, setEditProcessModal] = useState({
    isOpen: false,
    process: null as any
  })

  // Custom dialogs hook
  const { alert, confirm, success, error, warning, confirmProcessAction, confirmWeightUpdate } = useCustomDialogs()

  const fetchData = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const [orderRes, karigarsRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`, {
          headers: { 'Authorization': sessionToken ? `Bearer ${sessionToken}` : '' }
        }),
        fetch('/api/karigars', {
          headers: { 'Authorization': sessionToken ? `Bearer ${sessionToken}` : '' }
        })
      ])

      if (orderRes.ok) {
        const orderData = await orderRes.json()
        const orderInfo = orderData.order
        setOrder(orderInfo)
        setProcesses(orderInfo.processes || [])

        // Automatically calculate input weight for next process
        const completedProcesses = (orderInfo.processes || []).filter((p: any) => p.status === 'COMPLETED')
        let nextInputWeight = orderInfo.totalGoldUsed // Default to original gold weight

        if (completedProcesses.length > 0) {
          // Sort by sequence and get the last completed process output
          const sortedCompleted = completedProcesses.sort((a: any, b: any) => b.sequence - a.sequence)
          nextInputWeight = sortedCompleted[0].outputWeight
        }

        // Auto-set the input weight for the next process
        setStartFormData(prev => ({
          ...prev,
          inputWeight: nextInputWeight.toFixed(3)
        }))
      }

      if (karigarsRes.ok) {
        const karigarData = await karigarsRes.json()
        setKarigars(karigarData.karigars || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [orderId])

  // Update input weight when stones are added in stone setting process
  useEffect(() => {
    if (startFormData.processType === 'STONE_SETTING') {
      // Store original weight when first switching to stone setting
      if (!originalInputWeight && startFormData.inputWeight) {
        setOriginalInputWeight(startFormData.inputWeight)
        return // Don't calculate on first setup, just store the original weight
      }

      // Only proceed if we have the original weight stored
      if (originalInputWeight) {
        // Calculate total stone weight - ONLY for valid stones (same logic as submission)
        const totalStoneWeight = (
          stoneFormData.adStones
            .filter(stone => stone.sizeMm && stone.pieces && stone.totalWeight)
            .reduce((sum, stone) => {
              const weight = parseFloat(stone.totalWeight) || 0
              return sum + weight
            }, 0) +
          stoneFormData.kalesStones
            .filter(stone => stone.sizeMm && stone.pieces && stone.totalWeight)
            .reduce((sum, stone) => {
              const weight = parseFloat(stone.totalWeight) || 0
              return sum + weight
            }, 0)
        )

        // Update input weight to include stone weight
        const originalWeight = parseFloat(originalInputWeight)
        const newInputWeight = originalWeight + totalStoneWeight

        setStartFormData(prev => ({
          ...prev,
          inputWeight: newInputWeight.toFixed(3)
        }))
      }
    } else {
      // Reset to original weight when not in stone setting mode
      if (originalInputWeight) {
        setStartFormData(prev => ({
          ...prev,
          inputWeight: originalInputWeight
        }))
        setOriginalInputWeight('')
      }
    }
  }, [startFormData.processType, stoneFormData, originalInputWeight])

  // Calculate new input weight when additional weight changes
  useEffect(() => {
    if (updateFormData.additionalWeight) {
      const additionalWeight = parseFloat(updateFormData.additionalWeight) || 0
      const newTotal = updateFormData.currentWeight + additionalWeight
      setUpdateFormData(prev => ({
        ...prev,
        newInputWeight: newTotal
      }))
    } else {
      setUpdateFormData(prev => ({
        ...prev,
        newInputWeight: prev.currentWeight
      }))
    }
  }, [updateFormData.additionalWeight, updateFormData.currentWeight])

  const handleStartProcess = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!startFormData.karigarId || !startFormData.processType || !startFormData.inputWeight) {
      await warning('Missing Information', 'Please fill all required fields')
      return
    }

    const inputWeight = parseFloat(startFormData.inputWeight)
    if (inputWeight <= 0) {
      await error('Invalid Weight', 'Input weight must be greater than 0')
      return
    }

    // Show confirmation before starting process
    const karigar = karigars.find(k => k.id === startFormData.karigarId)
    const confirmMessage = `Start ${startFormData.processType} process?\n\n` +
      `Karigar: ${karigar?.name || 'Unknown'}\n` +
      `Input Weight: ${inputWeight.toFixed(3)}g\n` +
      `Process Type: ${startFormData.processType}`

    const confirmed = await confirm(
      'Start Process',
      confirmMessage,
      'info',
      'OK',
      'Cancel'
    )

    if (!confirmed) return

    setSubmitting('start')
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      // Prepare request body
      const requestBody: any = {
        karigarId: startFormData.karigarId,
        processType: startFormData.processType,
        inputWeight
      }

      // Add stone data for stone setting processes
      if (startFormData.processType === 'STONE_SETTING') {
        // Filter out empty stone entries and convert to proper format
        const validAdStones = stoneFormData.adStones
          .filter(stone => stone.sizeMm && stone.pieces && stone.totalWeight)
          .map(stone => ({
            sizeMm: parseFloat(stone.sizeMm),
            pieces: parseInt(stone.pieces),
            totalWeight: parseFloat(stone.totalWeight)
          }))

        const validKalesStones = stoneFormData.kalesStones
          .filter(stone => stone.sizeMm && stone.pieces && stone.totalWeight)
          .map(stone => ({
            sizeMm: parseFloat(stone.sizeMm),
            pieces: parseInt(stone.pieces),
            totalWeight: parseFloat(stone.totalWeight)
          }))

        if (validAdStones.length > 0) {
          requestBody.adStonesAdded = validAdStones
        }

        if (validKalesStones.length > 0) {
          requestBody.kalesStonesAdded = validKalesStones
        }
      }

      const response = await fetch(`/api/orders/${orderId}/processes/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const result = await response.json()
        await success('Process Started Successfully', result.message, 'OK')
        // Reset form but keep the auto-calculated input weight for next process
        setStartFormData({ karigarId: '', processType: '', inputWeight: startFormData.inputWeight })
        // Reset stone form data and original weight
        setStoneFormData({
          adStones: [{ sizeMm: '', pieces: '', totalWeight: '' }],
          kalesStones: [{ sizeMm: '', pieces: '', totalWeight: '' }]
        })
        setOriginalInputWeight('')
        await fetchData() // This will auto-update the input weight for next process
        if (onProcessUpdate) onProcessUpdate()
      } else {
        const errorData = await response.json()
        await error('Process Start Failed', errorData.error)
      }
    } catch (err) {
      console.error('Error starting process:', err)
      await error('Connection Error', 'Failed to start process. Please check your connection and try again.')
    } finally {
      setSubmitting('')
    }
  }

  const handleCompleteProcess = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!completeFormData.processId || !completeFormData.outputWeight) {
      await warning('Missing Information', 'Please fill all required fields')
      return
    }

    const outputWeight = parseFloat(completeFormData.outputWeight)
    if (outputWeight < 0) {
      await error('Invalid Weight', 'Output weight cannot be negative')
      return
    }

    // Show confirmation before completing process
    const process = processes.find(p => p.id === completeFormData.processId)
    const inputWeight = process?.inputWeight || 0
    const goldLoss = Math.max(0, inputWeight - outputWeight)

    const confirmMessage = `Complete ${process?.processType || 'Unknown'} process?\n\n` +
      `Karigar: ${process?.karigar?.name || 'Unknown'}\n` +
      `Input Weight: ${inputWeight.toFixed(3)}g\n` +
      `Output Weight: ${outputWeight.toFixed(3)}g\n` +
      `Gold Loss: ${goldLoss.toFixed(3)}g`

    const confirmed = await confirm(
      'Complete Process',
      confirmMessage,
      'warning',
      'OK',
      'Cancel'
    )

    if (!confirmed) return

    setSubmitting('complete')
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      // Prepare the request body
      const requestBody: any = {
        processId: completeFormData.processId,
        outputWeight
      }

      // Stone data is already stored in the process record from when it was started
      // No need to send it again when completing

      const response = await fetch(`/api/orders/${orderId}/processes/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const result = await response.json()
        await success('Process Completed Successfully', result.message, 'OK')
        setCompleteFormData({ processId: '', outputWeight: '' })
        await fetchData() // This will auto-update the input weight for next process
        if (onProcessUpdate) onProcessUpdate()
      } else {
        const errorData = await response.json()
        await error('Process Completion Failed', errorData.error)
      }
    } catch (err) {
      console.error('Error completing process:', err)
      await error('Connection Error', 'Failed to complete process. Please check your connection and try again.')
    } finally {
      setSubmitting('')
    }
  }

  const handleUpdateInputWeight = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!updateFormData.processId || !updateFormData.additionalWeight || !updateFormData.description.trim()) {
      await warning('Missing Information', 'Please fill all required fields: additional weight and description')
      return
    }

    const additionalWeight = parseFloat(updateFormData.additionalWeight)
    if (additionalWeight <= 0) {
      await error('Invalid Weight', 'Additional weight must be greater than 0')
      return
    }

    const process = processes.find(p => p.id === updateFormData.processId)
    if (!process) {
      await error('Process Not Found', 'Process not found')
      return
    }

    const newInputWeight = updateFormData.currentWeight + additionalWeight

    // Show confirmation dialog with OK/Cancel buttons
    const confirmed = await confirmWeightUpdate(
      updateFormData.currentWeight,
      additionalWeight,
      `${updateFormData.description}\n\nThis will use ${additionalWeight.toFixed(3)}g from extra ${order?.selectedKarat || 92}% stock.`
    )

    if (confirmed) {
      await executeUpdateInputWeight(newInputWeight, additionalWeight, updateFormData.description)
    }
  }

  // Separate function to execute the update after confirmation
  const executeUpdateInputWeight = async (newInputWeight: number, additionalWeight?: number, description?: string) => {

    setSubmitting('update')
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      const response = await fetch(`/api/orders/${orderId}/processes/${updateFormData.processId}/update-input`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          newInputWeight,
          additionalWeight,
          description
        })
      })

      if (response.ok) {
        const result = await response.json()
        await success('Weight Updated Successfully', result.message)
        setUpdateFormData({
          processId: '',
          currentWeight: 0,
          additionalWeight: '',
          newInputWeight: 0,
          description: '',
          isOpen: false
        })
        await fetchData() // Refresh data
        if (onProcessUpdate) onProcessUpdate()
      } else {
        const errorData = await response.json()
        await error('Weight Update Failed', errorData.error)
      }
    } catch (err) {
      console.error('Error updating input weight:', err)
      await error('Connection Error', 'Failed to update input weight. Please check your connection and try again.')
    } finally {
      setSubmitting('')
    }
  }

  const openUpdateModal = (processId: string, currentWeight: number) => {
    setUpdateFormData({
      processId,
      currentWeight,
      additionalWeight: '',
      newInputWeight: currentWeight,
      description: '',
      isOpen: true
    })
  }

  const closeUpdateModal = () => {
    setUpdateFormData({
      processId: '',
      currentWeight: 0,
      additionalWeight: '',
      newInputWeight: 0,
      description: '',
      isOpen: false
    })
  }

  // Process Edit Modal Handlers
  const handleEditProcess = (process: any) => {
    console.log('✏️ Opening edit modal for process:', process)
    setEditProcessModal({
      isOpen: true,
      process: process
    })
  }

  const handleCloseEditProcess = () => {
    setEditProcessModal({
      isOpen: false,
      process: null
    })
  }

  const handleEditProcessSubmit = async (processId: string, updateData: any) => {
    console.log('📤 Submitting process edit:', { processId, updateData })

    setSubmitting('edit')
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/processes/${processId}/edit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Process updated successfully:', result)

        await success(
          'Process Updated Successfully',
          `Input Weight: ${updateData.inputWeight.toFixed(3)}g\n` +
          `Output Weight: ${updateData.outputWeight.toFixed(3)}g\n` +
          `Gold Loss: ${updateData.goldLoss.toFixed(3)}g`
        )

        handleCloseEditProcess()
        await fetchData() // Refresh the data to show updated values
        if (onProcessUpdate) onProcessUpdate()
      } else {
        const errorData = await response.json()
        await error('Process Update Failed', errorData.error)
      }
    } catch (err) {
      console.error('Error updating process:', err)
      await error('Connection Error', 'Failed to update process. Please check your connection and try again.')
    } finally {
      setSubmitting('')
    }
  }

  const handleDeleteProcess = async (processId: string, processType: string, inputWeight: number, status: string) => {
    // Show confirmation dialog with OK/Cancel buttons
    const details = `Process: ${processType}\n` +
      `Input Weight: ${inputWeight.toFixed(3)}g\n` +
      `Status: ${status}\n\n` +
      `⚠️ This action cannot be undone!\n` +
      `The gold used in this process will be restored to stock.`

    const confirmed = await confirmProcessAction('Delete Process', details)

    if (!confirmed) return

    setSubmitting(`delete-${processId}`)
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      const response = await fetch(`/api/orders/${orderId}/processes/${processId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (response.ok) {
        const result = await response.json()
        await success('Process Deleted Successfully', result.message, 'OK')
        await fetchData() // This will refresh the processes list
        if (onProcessUpdate) onProcessUpdate()
      } else {
        const errorData = await response.json()
        await error('Process Deletion Failed', errorData.error)
      }
    } catch (err) {
      console.error('Error deleting process:', err)
      await error('Connection Error', 'Failed to delete process. Please check your connection and try again.')
    } finally {
      setSubmitting('')
    }
  }


  const getProcessStatusColor = (status: string) => {
    switch (status) {
      case 'STARTED': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const startedProcesses = processes.filter(p => p.status === 'STARTED')
  const completedProcesses = processes.filter(p => p.status === 'COMPLETED')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Process Status Overview */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Process Status Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Started Processes */}
          <div>
            <h3 className="text-lg font-medium text-yellow-600 mb-3">🔄 In Progress ({startedProcesses.length})</h3>
            {startedProcesses.length === 0 ? (
              <p className="text-gray-500 text-sm">No processes currently in progress</p>
            ) : (
              <div className="space-y-2">
                {startedProcesses.map(process => (
                  <div key={process.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{process.processType}</p>
                        <p className="text-sm text-gray-600">Karigar: {process.karigar.name}</p>
                        <p className="text-sm text-gray-600">Input: {process.inputWeight}g</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          Started {new Date(process.startedAt).toLocaleDateString()}
                        </span>
                        {/* Edit Process option for ALL process types */}
                        <button
                          onClick={() => handleEditProcess(process)}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded font-medium mr-1"
                          disabled={submitting === 'edit'}
                          title={`Edit ${process.processType} process details`}
                        >
                          ✏️ Edit Process
                        </button>
                        {/* Update Weight option for ALL process types */}
                        <button
                          onClick={() => openUpdateModal(process.id, process.inputWeight)}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded font-medium mr-1"
                          disabled={submitting === 'update'}
                          title={`Update input weight for ${process.processType} process`}
                        >
                          📝 Update Weight
                        </button>
                        <button
                          onClick={() => handleDeleteProcess(process.id, process.processType, process.inputWeight, process.status)}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-medium"
                          disabled={submitting.startsWith('delete')}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Processes */}
          <div>
            <h3 className="text-lg font-medium text-green-600 mb-3">✅ Completed ({completedProcesses.length})</h3>
            {completedProcesses.length === 0 ? (
              <p className="text-gray-500 text-sm">No completed processes yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {completedProcesses
                  .sort((a, b) => b.sequence - a.sequence) // Show most recent first
                  .map((process, index) => (
                    <div key={process.id} className={`bg-green-50 border border-green-200 rounded-lg p-3 ${index === 0 ? 'ring-2 ring-blue-300' : ''
                      }`}>
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {process.processType}
                            {index === 0 && <span className="ml-2 text-xs text-blue-600 font-bold">← LATEST</span>}
                          </p>
                          <p className="text-sm text-gray-600">Karigar: {process.karigar.name}</p>
                          <p className="text-sm text-gray-600">
                            {process.inputWeight}g → <span className="font-bold text-green-700">{process.outputWeight}g</span> (Loss: {process.goldLoss}g)
                          </p>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Completed
                          </span>
                          {/* Edit Process option for completed processes */}
                          <button
                            onClick={() => handleEditProcess(process)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded font-medium"
                            disabled={submitting === 'edit'}
                            title={`Edit ${process.processType} process details`}
                          >
                            ✏️ Edit Process
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Order Section */}
      {completedProcesses.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg shadow-md border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-green-800 mb-2">✅ Ready to Complete Order?</h2>
              <p className="text-green-700 mb-4">
                You have {completedProcesses.length} completed process{completedProcesses.length > 1 ? 'es' : ''}. You can finalize this order at any stage to move it to the billing phase.
              </p>
              <div className="mb-3">
                <p className="text-sm text-green-600">
                  📋 Completed: {completedProcesses.map(p => p.processType).join(', ')}
                </p>
                {startedProcesses.length > 0 && (
                  <p className="text-sm text-yellow-600">
                    🔄 In Progress: {startedProcesses.map(p => p.processType).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end space-y-3">
              <Link
                href={`/orders/${orderId}/complete`}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold text-lg shadow-lg transform transition-all duration-200 hover:scale-105 flex items-center space-x-2"
              >
                <span>🏁</span>
                <span>Complete Order</span>
              </Link>
              <p className="text-xs text-gray-600 text-center max-w-48">
                Finalize manufacturing and move to billing
              </p>
            </div>
          </div>

          {/* Process Summary */}
          <div className="mt-4 bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-gray-900 mb-3">📊 Manufacturing Progress Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-green-50 rounded">
                <p className="text-gray-600">Completed Processes</p>
                <p className="text-xl font-bold text-green-600">{completedProcesses.length}</p>
                <p className="text-xs text-gray-500">
                  {completedProcesses.length > 0 ? completedProcesses.map(p => p.processType).join(', ') : 'None'}
                </p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded">
                <p className="text-gray-600">In Progress</p>
                <p className="text-xl font-bold text-yellow-600">{startedProcesses.length}</p>
                <p className="text-xs text-gray-500">
                  {startedProcesses.length > 0 ? startedProcesses.map(p => p.processType).join(', ') : 'None'}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded">
                <p className="text-gray-600">Latest Output Weight</p>
                <p className="text-xl font-bold text-blue-600">
                  {completedProcesses.length > 0
                    ? `${completedProcesses.sort((a, b) => b.sequence - a.sequence)[0]?.outputWeight?.toFixed(3)}g`
                    : 'N/A'
                  }
                </p>
                <p className="text-xs text-gray-500">
                  {completedProcesses.length > 0
                    ? `From ${completedProcesses.sort((a, b) => b.sequence - a.sequence)[0]?.processType}`
                    : 'No processes completed'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
            <div className="flex items-start space-x-2">
              <span className="text-amber-600 mt-0.5">💡</span>
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Order Completion Tips:</p>
                <ul className="text-xs space-y-1">
                  <li>• You can complete the order at any stage after at least one process is finished</li>
                  <li>• If you have processes in progress, you'll be asked to confirm early completion</li>
                  <li>• Final weight calculations will be based on the last completed process output</li>
                  <li>• Once completed, the order will move to the billing phase</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start New Process */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🚀 Start New Process</h2>

        {/* Automatic Flow Indicator */}
        {completedProcesses.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <span className="text-blue-600 mr-2">🔄</span>
              <span className="text-sm font-medium text-blue-800">
                Automatic Flow: Last output ({completedProcesses.sort((a, b) => b.sequence - a.sequence)[0]?.outputWeight?.toFixed(3)}g) → Next input
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleStartProcess} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Process Type *
              </label>
              <select
                required
                value={startFormData.processType}
                onChange={(e) => {
                  setStartFormData({ ...startFormData, processType: e.target.value })
                  // Reset stone form data when process type changes
                  if (e.target.value !== 'STONE_SETTING') {
                    setStoneFormData({
                      adStones: [{ sizeMm: '', pieces: '', totalWeight: '' }],
                      kalesStones: [{ sizeMm: '', pieces: '', totalWeight: '' }]
                    })
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select process type</option>
                <option value="FILING">Filing</option>
                <option value="FREE_POLISH">Free Polish</option>
                <option value="STONE_SETTING">Stone Setting</option>
                <option value="FINAL_POLISH">Final Polish</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Karigar *
              </label>
              <select
                required
                value={startFormData.karigarId}
                onChange={(e) => setStartFormData({ ...startFormData, karigarId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select karigar</option>
                {karigars.map((karigar) => (
                  <option key={karigar.id} value={karigar.id}>
                    {karigar.name} {karigar.specialty && `(${karigar.specialty})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Input Weight (grams) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={startFormData.inputWeight}
                onChange={(e) => setStartFormData({ ...startFormData, inputWeight: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-blue-50"
                placeholder="Auto-calculated from previous output"
              />
              <p className="mt-1 text-xs text-blue-600">
                💡 Auto-set from {completedProcesses.length > 0 ? 'last process output' : 'initial order gold weight'}
              </p>
            </div>
          </div>

          {/* Stone Setting Fields - Show when STONE_SETTING is selected */}
          {startFormData.processType === 'STONE_SETTING' && (
            <div className="bg-purple-50 p-4 rounded-md border border-purple-200 space-y-6">
              <div className="flex items-center mb-4">
                <span className="text-purple-600 text-lg mr-2">💎</span>
                <h4 className="text-lg font-medium text-purple-900">Stone Setting Configuration</h4>
              </div>

              {/* AD Stones Section */}
              <div>
                <h5 className="text-sm font-medium text-gray-800 mb-3">AD Stones (American Diamond)</h5>
                {stoneFormData.adStones.map((stone, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 p-3 bg-white rounded border">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Size (mm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={stone.sizeMm}
                        onChange={(e) => {
                          const newAdStones = [...stoneFormData.adStones]
                          newAdStones[index].sizeMm = e.target.value
                          setStoneFormData({ ...stoneFormData, adStones: newAdStones })
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Pieces
                      </label>
                      <input
                        type="number"
                        value={stone.pieces}
                        onChange={(e) => {
                          const newAdStones = [...stoneFormData.adStones]
                          newAdStones[index].pieces = e.target.value
                          setStoneFormData({ ...stoneFormData, adStones: newAdStones })
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Total Weight (g)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={stone.totalWeight}
                        onChange={(e) => {
                          const newAdStones = [...stoneFormData.adStones]
                          newAdStones[index].totalWeight = e.target.value
                          setStoneFormData({ ...stoneFormData, adStones: newAdStones })
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.500"
                      />
                    </div>
                    <div className="flex items-end">
                      {stoneFormData.adStones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newAdStones = stoneFormData.adStones.filter((_, i) => i !== index)
                            setStoneFormData({ ...stoneFormData, adStones: newAdStones })
                          }}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setStoneFormData({
                      ...stoneFormData,
                      adStones: [...stoneFormData.adStones, { sizeMm: '', pieces: '', totalWeight: '' }]
                    })
                  }}
                  className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                >
                  + Add AD Stone
                </button>
              </div>

              {/* Kales Stones Section */}
              <div>
                <h5 className="text-sm font-medium text-gray-800 mb-3">Kales Stones (Colored Synthetic)</h5>
                {stoneFormData.kalesStones.map((stone, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 p-3 bg-white rounded border">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Size (mm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={stone.sizeMm}
                        onChange={(e) => {
                          const newKalesStones = [...stoneFormData.kalesStones]
                          newKalesStones[index].sizeMm = e.target.value
                          setStoneFormData({ ...stoneFormData, kalesStones: newKalesStones })
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                        placeholder="3.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Pieces
                      </label>
                      <input
                        type="number"
                        value={stone.pieces}
                        onChange={(e) => {
                          const newKalesStones = [...stoneFormData.kalesStones]
                          newKalesStones[index].pieces = e.target.value
                          setStoneFormData({ ...stoneFormData, kalesStones: newKalesStones })
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Total Weight (g)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={stone.totalWeight}
                        onChange={(e) => {
                          const newKalesStones = [...stoneFormData.kalesStones]
                          newKalesStones[index].totalWeight = e.target.value
                          setStoneFormData({ ...stoneFormData, kalesStones: newKalesStones })
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                        placeholder="0.300"
                      />
                    </div>
                    <div className="flex items-end">
                      {stoneFormData.kalesStones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newKalesStones = stoneFormData.kalesStones.filter((_, i) => i !== index)
                            setStoneFormData({ ...stoneFormData, kalesStones: newKalesStones })
                          }}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setStoneFormData({
                      ...stoneFormData,
                      kalesStones: [...stoneFormData.kalesStones, { sizeMm: '', pieces: '', totalWeight: '' }]
                    })
                  }}
                  className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200"
                >
                  + Add Kales Stone
                </button>
              </div>

              {/* Weight Calculation Preview */}
              <div className="bg-white p-3 rounded border">
                <h6 className="text-xs font-medium text-gray-700 mb-2">Weight Calculation Preview</h6>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Original Gold Weight:</span>
                    <span className="font-medium">{originalInputWeight || startFormData.inputWeight || '0.000'}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AD Stones Weight:</span>
                    <span className="font-medium text-blue-600">
                      +{stoneFormData.adStones
                        .filter(stone => stone.sizeMm && stone.pieces && stone.totalWeight)
                        .reduce((sum, stone) => {
                          const weight = parseFloat(stone.totalWeight) || 0
                          return sum + weight
                        }, 0).toFixed(3)}g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kales Stones Weight:</span>
                    <span className="font-medium text-purple-600">
                      +{stoneFormData.kalesStones
                        .filter(stone => stone.sizeMm && stone.pieces && stone.totalWeight)
                        .reduce((sum, stone) => {
                          const weight = parseFloat(stone.totalWeight) || 0
                          return sum + weight
                        }, 0).toFixed(3)}g
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span>Total Combined Weight:</span>
                    <span className="font-bold text-green-600">
                      {(
                        (parseFloat(originalInputWeight || startFormData.inputWeight) || 0) +
                        stoneFormData.adStones
                          .filter(stone => stone.sizeMm && stone.pieces && stone.totalWeight)
                          .reduce((sum, stone) => sum + (parseFloat(stone.totalWeight) || 0), 0) +
                        stoneFormData.kalesStones
                          .filter(stone => stone.sizeMm && stone.pieces && stone.totalWeight)
                          .reduce((sum, stone) => sum + (parseFloat(stone.totalWeight) || 0), 0)
                      ).toFixed(3)}g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting === 'start'}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium"
          >
            {submitting === 'start' ? 'Starting Process...' : 'Start Process (Record Input)'}
          </button>
        </form>
      </div>

      {/* Complete Process */}
      {startedProcesses.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">✅ Complete Process</h2>
          <form onSubmit={handleCompleteProcess} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Process to Complete *
                </label>
                <select
                  required
                  value={completeFormData.processId}
                  onChange={(e) => setCompleteFormData({ ...completeFormData, processId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select process to complete</option>
                  {startedProcesses.map((process) => (
                    <option key={process.id} value={process.id}>
                      {process.processType} - {process.karigar.name} (Input: {process.inputWeight}g)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Output Weight (grams) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={completeFormData.outputWeight}
                  onChange={(e) => setCompleteFormData({ ...completeFormData, outputWeight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter output weight"
                />
                {completeFormData.processId && (
                  <p className="mt-1 text-sm text-gray-600">
                    {(() => {
                      const process = startedProcesses.find(p => p.id === completeFormData.processId)
                      const outputWeight = parseFloat(completeFormData.outputWeight)
                      if (process && outputWeight > 0) {
                        if (process.processType === 'STONE_SETTING') {
                          // Use stone data from the process record (stored when process was started)
                          const stoneWeight = ((process.adStonesAdded || []).reduce((sum: number, stone: any) => sum + stone.totalWeight, 0) +
                            (process.kalesStonesAdded || []).reduce((sum: number, stone: any) => sum + stone.totalWeight, 0))
                          const loss = Math.max(0, (process.inputWeight + stoneWeight) - outputWeight)
                          return `With stones (+${stoneWeight.toFixed(3)}g), estimated loss: ${loss.toFixed(3)}g`
                        } else {
                          const loss = Math.max(0, process.inputWeight - outputWeight)
                          return `Estimated loss: ${loss.toFixed(3)}g`
                        }
                      }
                      return 'Enter output weight to see estimated loss'
                    })()}
                  </p>
                )}
              </div>
            </div>

            {/* Stone Setting Information - Show when completing a stone setting process */}
            {(() => {
              const selectedProcess = startedProcesses.find(p => p.id === completeFormData.processId)
              if (selectedProcess?.processType === 'STONE_SETTING') {
                return (
                  <div className="bg-purple-50 p-4 rounded-md border border-purple-200">
                    <h4 className="text-md font-medium text-purple-900 mb-3">🔮 Stone Setting Details</h4>

                    {/* AD Stones from Process Record */}
                    {selectedProcess?.adStonesAdded && selectedProcess.adStonesAdded.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-800 mb-2">AD Stones (American Diamond)</h5>
                        <div className="space-y-2">
                          {selectedProcess.adStonesAdded.map((stone: any, index: number) => (
                            <div key={index} className="flex justify-between items-center bg-white p-2 rounded border">
                              <span className="text-sm text-gray-600">
                                Size: {stone.sizeMm}mm • Pieces: {stone.pieces}
                              </span>
                              <span className="text-sm font-medium text-blue-600">
                                {stone.totalWeight.toFixed(3)}g
                              </span>
                            </div>
                          ))}
                          <div className="text-xs text-blue-600 font-medium">
                            Total AD Weight: +{selectedProcess.adStonesAdded.reduce((sum: number, stone: any) => sum + stone.totalWeight, 0).toFixed(3)}g
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Kales Stones from Process Record */}
                    {selectedProcess?.kalesStonesAdded && selectedProcess.kalesStonesAdded.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Kales Stones (Colored Synthetic)</h5>
                        <div className="space-y-2">
                          {selectedProcess.kalesStonesAdded.map((stone: any, index: number) => (
                            <div key={index} className="flex justify-between items-center bg-white p-2 rounded border">
                              <span className="text-sm text-gray-600">
                                Size: {stone.sizeMm}mm • Pieces: {stone.pieces}
                              </span>
                              <span className="text-sm font-medium text-purple-600">
                                {stone.totalWeight.toFixed(3)}g
                              </span>
                            </div>
                          ))}
                          <div className="text-xs text-purple-600 font-medium">
                            Total Kales Weight: +{selectedProcess.kalesStonesAdded.reduce((sum: number, stone: any) => sum + stone.totalWeight, 0).toFixed(3)}g
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Weight Calculation Guide */}
                    <div className="bg-white p-3 rounded border">
                      <h6 className="text-xs font-medium text-gray-700 mb-2">Weight Calculation Guide</h6>
                      <div className="text-xs space-y-1">
                        {(() => {
                          // Calculate original gold weight by subtracting stone weights from stored input weight
                          const totalStoneWeight = (
                            (selectedProcess?.adStonesAdded || []).reduce((sum: number, stone: any) => sum + stone.totalWeight, 0) +
                            (selectedProcess?.kalesStonesAdded || []).reduce((sum: number, stone: any) => sum + stone.totalWeight, 0)
                          )
                          const originalGoldWeight = selectedProcess.inputWeight - totalStoneWeight

                          return (
                            <>
                              <div className="flex justify-between">
                                <span>Original Gold Weight:</span>
                                <span className="font-medium">{originalGoldWeight.toFixed(3)}g</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Stone Weight:</span>
                                <span className="font-medium text-green-600">
                                  +{totalStoneWeight.toFixed(3)}g
                                </span>
                              </div>
                              <div className="flex justify-between border-t pt-1">
                                <span>Total Combined Weight:</span>
                                <span className="font-bold">
                                  {selectedProcess.inputWeight.toFixed(3)}g
                                </span>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    {/* No stones message */}
                    {(!selectedProcess?.adStonesAdded || selectedProcess.adStonesAdded.length === 0) && (!selectedProcess?.kalesStonesAdded || selectedProcess.kalesStonesAdded.length === 0) && (
                      <div className="text-center py-4 bg-gray-50 rounded border">
                        <p className="text-gray-500 text-sm mb-1">No stones were added for this stone setting process</p>
                        <p className="text-xs text-gray-400">Stone setting proceeding without adding stone weight</p>
                      </div>
                    )}
                  </div>
                )
              }
              return null
            })()}

            <button
              type="submit"
              disabled={submitting === 'complete'}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg font-medium"
            >
              {submitting === 'complete' ? 'Completing Process...' : 'Complete Process (Record Output)'}
            </button>
          </form>
        </div>
      )}

      {/* Process History */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Process History</h2>
        {processes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No processes yet. Start the first process above.</p>
        ) : (
          <div className="space-y-3">
            {processes
              .sort((a, b) => a.sequence - b.sequence)
              .map((process) => (
                <div
                  key={process.id}
                  className={`border rounded-lg p-4 ${process.status === 'STARTED' ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {process.processType}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Karigar: {process.karigar.name}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getProcessStatusColor(process.status)}`}>
                        {process.status === 'STARTED' ? '🔄 In Progress' : '✅ Completed'}
                      </span>
                      <button
                        onClick={() => handleDeleteProcess(process.id, process.processType, process.inputWeight, process.status)}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-medium"
                        disabled={submitting.startsWith('delete')}
                        title="Delete this process and restore stock"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Input:</span>
                      <span className="ml-1 font-medium">{process.inputWeight.toFixed(3)}g</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Output:</span>
                      <span className="ml-1 font-medium">
                        {process.outputWeight !== undefined ? `${process.outputWeight.toFixed(3)}g` : 'Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Loss:</span>
                      <span className="ml-1 font-medium text-red-600">
                        {process.goldLoss !== undefined ? `${process.goldLoss.toFixed(3)}g` : 'TBD'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Started: {new Date(process.startedAt).toLocaleString()}
                    {process.completedAt && (
                      <span className="ml-4">
                        Completed: {new Date(process.completedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Update Input Weight Modal */}
      {updateFormData.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">📦 Add Extra Weight to Process</h3>

              {(() => {
                const process = processes.find(p => p.id === updateFormData.processId)
                if (!process) return null

                return (
                  <div className="mb-4 p-3 bg-gray-50 rounded border">
                    <p className="text-sm font-medium text-gray-900">{process.processType}</p>
                    <p className="text-sm text-gray-600">Karigar: {process.karigar.name}</p>
                    <p className="text-sm text-gray-600">Current Input: {process.inputWeight.toFixed(3)}g</p>
                  </div>
                )
              })()}

              <form onSubmit={handleUpdateInputWeight} className="space-y-4">
                {/* Current Weight - Read Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Input Weight
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${updateFormData.currentWeight.toFixed(3)}g`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-600"
                  />
                  <p className="mt-1 text-xs text-gray-500">This is the current weight being processed</p>
                </div>

                {/* Additional Weight - User Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Weight (grams) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={updateFormData.additionalWeight}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, additionalWeight: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter additional weight needed (e.g., 2.000)"
                  />
                  <p className="mt-1 text-xs text-gray-500">Only enter the extra weight you want to add</p>
                </div>

                {/* New Total Weight - Calculated */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Total Weight
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${updateFormData.newInputWeight.toFixed(3)}g`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-blue-50 text-blue-800 font-medium"
                  />
                  <p className="mt-1 text-xs text-blue-600">
                    {updateFormData.currentWeight.toFixed(3)}g + {(parseFloat(updateFormData.additionalWeight) || 0).toFixed(3)}g = {updateFormData.newInputWeight.toFixed(3)}g
                  </p>
                </div>

                {/* Description - Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description/Reason *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={updateFormData.description}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Why is this additional weight needed? (e.g., 'Stone setting requires extra gold', 'Design modification', 'Weight correction')"
                  />
                  <p className="mt-1 text-xs text-gray-500">Please provide a clear reason for this weight increase</p>
                </div>

                {/* Extra Stock Info */}
                {updateFormData.additionalWeight && parseFloat(updateFormData.additionalWeight) > 0 && (
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <h4 className="text-sm font-medium text-yellow-800 mb-1">📦 Extra Stock Usage</h4>
                    <div className="text-sm text-yellow-700 space-y-1">
                      <p>• Will use {parseFloat(updateFormData.additionalWeight).toFixed(3)}g from Extra {order?.selectedKarat || 92}% stock</p>
                      <p>• Fine gold equivalent: {((parseFloat(updateFormData.additionalWeight) || 0) * ((order?.selectedKarat || 92) / 100)).toFixed(3)}g</p>
                      <p>• Make sure you have sufficient extra stock before proceeding</p>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">ℹ️ How This Works</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• Only additional weight can be added (no reductions)</p>
                    <p>• Extra karat stock will be used automatically</p>
                    <p>• Current weight remains unchanged, only adds extra</p>
                    <p>• Description helps track why extra weight was needed</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 pt-4">
                  <button
                    type="submit"
                    disabled={submitting === 'update'}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md font-medium"
                  >
                    {submitting === 'update' ? 'Adding Extra Weight...' : 'Add Extra Weight'}
                  </button>
                  <button
                    type="button"
                    onClick={closeUpdateModal}
                    disabled={submitting === 'update'}
                    className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Process Edit Modal */}
      <ProcessEditModal
        isOpen={editProcessModal.isOpen}
        onClose={handleCloseEditProcess}
        onSubmit={handleEditProcessSubmit}
        process={editProcessModal.process}
        isLoading={submitting === 'edit'}
      />

    </div>
  )
}

export default ProcessManager
