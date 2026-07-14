'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SimpleLossRecoveryModal from './SimpleLossRecoveryModal'
import EnhancedRecoveryModal from './EnhancedRecoveryModal'
import ProcessEditModal from './ProcessEditModal'
import OrderImage from './OrderImage'

interface Karigar {
  id: string
  name: string
  phone?: string
  specialty?: string
  createdAt: string
  bulkMakingCharge?: number // Bulk making charge for entire karigar
  processes?: Array<{
    id: string
    processType: string
    goldLoss: number
    goldRecovered?: number
    karigarMakingCharge?: number
    inputWeight: number
    outputWeight: number
    sequence: number
    createdAt: string
    orderId: string
    // Stone data for STONE_SETTING processes
    adStonesAdded?: Array<{
      sizeMm: number
      pieces: number
      totalWeight: number
    }>
    kalesStonesAdded?: Array<{
      sizeMm: number
      pieces: number
      totalWeight: number
    }>
    order: {
      id: string
      orderNumber?: string // Add order number field
      orderName: string
      orderPhoto?: string // Add order photo
      orderType: string
      status: string
      totalGoldUsed: number
      finalJewelryWeight: number
      selectedKarat?: number // Add karat purity
      createdAt: string
      customer: {
        name: string
        phone?: string
        email?: string
      }
    } | null
  }>
}


interface KarigarWorkHistoryPageProps {
  karigarId: string
}

const KarigarWorkHistoryPage: React.FC<KarigarWorkHistoryPageProps> = ({ karigarId }) => {
  const router = useRouter()
  const [karigar, setKarigar] = useState<Karigar | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Simple recovery modal state
  const [simpleRecoveryModal, setSimpleRecoveryModal] = useState({
    isOpen: false,
    processData: {
      type: '',
      totalLoss: 0,
      alreadyRecovered: 0,
      remainingLoss: 0,
      karatPurity: 92 // Default karat purity
    }
  })
  
  // Enhanced recovery modal state for new workflow
  const [enhancedRecoveryModal, setEnhancedRecoveryModal] = useState({
    isOpen: false,
    filteredData: {
      totalLoss: 0,
      alreadyRecovered: 0,
      remainingLoss: 0,
      orderCount: 0,
      karatType: ''
    }
  })
  
  const [processingRecovery, setProcessingRecovery] = useState(false)
  
  // Process edit modal state
  const [editProcessModal, setEditProcessModal] = useState({
    isOpen: false,
    process: null as any
  })
  const [processingEdit, setProcessingEdit] = useState(false)
  
  // Recovery history state
  const [recoveryHistory, setRecoveryHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    karat: 'all', // 'all', '22k', '18k', '19.2k'
    recoveryStatus: 'all', // 'all', 'fully_recovered', 'partially_recovered', 'pending'
    selectedDate: '' // Single date picker for filtering orders by specific date
  })

  useEffect(() => {
    fetchKarigarDetails()
    fetchRecoveryHistory()
  }, [karigarId])

  const fetchKarigarDetails = async () => {
    try {
      const response = await fetch(`/api/karigars/${karigarId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Karigar data received:', data.karigar)
        
        // Debug order photos and stone data
        data.karigar?.processes?.forEach((process: any, index: number) => {
          console.log(`📋 Process ${index + 1} (${process.processType}):`, {
            orderId: process.orderId,
            orderName: process.order?.orderName,
            orderPhoto: process.order?.orderPhoto,
            hasOrderPhoto: !!process.order?.orderPhoto,
            // Stone data debug
            adStonesAdded: process.adStonesAdded,
            kalesStonesAdded: process.kalesStonesAdded,
            hasStoneData: !!(process.adStonesAdded || process.kalesStonesAdded)
          })
        })
        
        setKarigar(data.karigar)
      } else {
        console.error('Karigar not found')
        router.push('/karigars')
      }
    } catch (error) {
      console.error('Error fetching karigar:', error)
      router.push('/karigars')
    } finally {
      setLoading(false)
    }
  }

  const fetchRecoveryHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/karigars/${karigarId}/recovery-history`)
      if (response.ok) {
        const data = await response.json()
        setRecoveryHistory(data.recoveryHistory || [])
      } else {
        console.error('Failed to fetch recovery history')
        setRecoveryHistory([])
      }
    } catch (error) {
      console.error('Error fetching recovery history:', error)
      setRecoveryHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Karat-specific recovery modal handlers
  const handleOpenKaratRecovery = (karatPurity: number, karatLabel: string, stats: any, pendingAmount: number) => {
    console.log(`📋 Opening ${karatLabel} recovery:`, {
      karatPurity,
      totalLoss: stats.loss,
      recovered: stats.recovered,
      pending: pendingAmount,
      orderCount: stats.count
    })
    
    setSimpleRecoveryModal({
      isOpen: true,
      processData: {
        type: karatLabel, // Use karat label (22k, 18k, 19.2k)
        totalLoss: stats.loss,
        alreadyRecovered: stats.recovered,
        remainingLoss: pendingAmount,
        karatPurity: karatPurity // Add karat purity for API
      }
    })
  }
  
  const handleSimpleRecoverySubmit = async (processType: string, makingCharge: number, actualRecovery: number, description: string) => {
    const karatPurity = simpleRecoveryModal.processData.karatPurity || 92
    
    console.log('📜 Submitting karat-specific recovery:', {
      processType,
      makingCharge,
      actualRecovery,
      description,
      karatPurity,
      karigarId
    })
    
    setProcessingRecovery(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      
      // Calculate total recovery amount as expected by karat-recovery API
      const recoveredAmount = makingCharge + actualRecovery
      
      const requestBody = {
        recoveredAmount,
        makingCharge,
        description,
        karatPurity: karatPurity
      }
      
      console.log('📤 Request body for karat-specific recovery:', requestBody)
      
      const response = await fetch(`/api/karigars/${karigarId}/karat-recovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Recovery successful:', result)
        
        const summary = result.summary
        const recoverySession = result.recoverySession
        
        const karatLabel = summary.karatLabel || processType
        
        alert(`Successfully recorded ${karatLabel} recovery!\n\n` +
          `Karat Type: ${karatLabel} (${karatPurity}% purity)\n` +
          `Total Amount: ${recoveredAmount}g\n` +
          `Making Charge: ${makingCharge}g\n` +
          `Actual Recovery: ${actualRecovery}g\n` +
          `Fine Gold Added: ${recoverySession.recoveredAmountFineGold.toFixed(3)}g\n` +
          `Processes Affected: ${recoverySession.processesAffected}\n` +
          `Remaining Pending: ${summary.remainingPending.toFixed(3)}g`
        )
        
        setSimpleRecoveryModal({ ...simpleRecoveryModal, isOpen: false })
        fetchKarigarDetails() // Refresh data
        fetchRecoveryHistory() // Refresh recovery history
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to record recovery')
      }
    } catch (error) {
      console.error('Error recording recovery:', error)
      alert('Failed to record recovery')
    } finally {
      setProcessingRecovery(false)
    }
  }
  
  const handleCloseSimpleRecovery = () => {
    setSimpleRecoveryModal({ ...simpleRecoveryModal, isOpen: false })
  }
  
  // Enhanced recovery modal handlers for new workflow
  const handleOpenEnhancedRecovery = () => {
    // Calculate filtered data for recovery
    const filteredTotalLoss = Object.values(filteredStatsByKarat).reduce((sum, stats) => sum + stats.loss, 0)
    const filteredTotalRecovered = Object.values(filteredStatsByKarat).reduce((sum, stats) => sum + stats.recovered, 0)
    const filteredRemainingLoss = Math.max(0, filteredTotalLoss - filteredTotalRecovered)
    
    let karatType = ''
    if (filters.karat === '22k') karatType = '22k'
    else if (filters.karat === '18k') karatType = '18k'
    else if (filters.karat === '19.2k') karatType = '19.2k'
    else karatType = 'Mixed Karats'
    
    setEnhancedRecoveryModal({
      isOpen: true,
      filteredData: {
        totalLoss: filteredTotalLoss,
        alreadyRecovered: filteredTotalRecovered,
        remainingLoss: filteredRemainingLoss,
        orderCount: displayProcesses.length,
        karatType: karatType
      }
    })
  }
  
  const handleCloseEnhancedRecovery = () => {
    setEnhancedRecoveryModal({ ...enhancedRecoveryModal, isOpen: false })
  }
  
  const handleEnhancedRecoverySubmit = async (makingCharge: number, recoveryAmount: number, description: string) => {
    console.log('📤 Submitting enhanced recovery:', {
      makingCharge,
      recoveryAmount,
      description,
      filteredOrdersCount: displayProcesses.length,
      karatFilter: filters.karat,
      karigarId
    })
    
    setProcessingRecovery(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      
      // Prepare request body for enhanced recovery API
      const requestBody = {
        makingCharge,
        recoveryAmount,
        description,
        filteredOrders: displayProcesses.map(p => p.id), // Send displayed order IDs
        karatFilter: filters.karat,
        recoveryStatusFilter: filters.recoveryStatus,
        selectedDate: filters.selectedDate
      }
      
      console.log('📤 Enhanced recovery request body:', requestBody)
      
      const response = await fetch(`/api/karigars/${karigarId}/enhanced-recovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Enhanced recovery successful:', result)
        
        // Calculate fine gold based on karat filter
        let purity = 0.92 // Default 22k
        if (filters.karat === '18k') purity = 0.755
        else if (filters.karat === '19.2k') purity = 0.80
        
        const fineGoldAdded = (recoveryAmount * purity).toFixed(3)
        
        alert(`Recovery completed successfully!\n\n` +
          `Making Charge: ${makingCharge.toFixed(3)}g\n` +
          `Recovery Amount: ${recoveryAmount.toFixed(3)}g\n` +
          `Orders Processed: ${displayProcesses.length}\n` +
          `Karat Type: ${filters.karat}\n` +
          `Fine Gold Added: ${fineGoldAdded}g`
        )
        
        handleCloseEnhancedRecovery()
        fetchKarigarDetails() // Refresh data
        fetchRecoveryHistory() // Refresh recovery history
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to complete recovery')
      }
    } catch (error) {
      console.error('Error in enhanced recovery:', error)
      alert('Failed to complete recovery')
    } finally {
      setProcessingRecovery(false)
    }
  }
  
  // Process edit handlers
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
    
    setProcessingEdit(true)
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
        
        alert(`Process updated successfully!\n\n` +
          `New Input Weight: ${updateData.inputWeight.toFixed(3)}g\n` +
          `Output Weight: ${updateData.outputWeight.toFixed(3)}g\n` +
          `Gold Loss: ${updateData.goldLoss.toFixed(3)}g`
        )
        
        handleCloseEditProcess()
        fetchKarigarDetails() // Refresh the data to show updated values
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update process')
      }
    } catch (error) {
      console.error('Error updating process:', error)
      alert('Failed to update process')
    } finally {
      setProcessingEdit(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!karigar) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Karigar not found</h2>
        <Link href="/karigars" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
          Back to Karigars
        </Link>
      </div>
    )
  }


  // Helper function to safely convert to number and handle NaN
  const safeNumber = (value: any): number => {
    const num = parseFloat(String(value || 0))
    return isNaN(num) ? 0 : num
  }
  
  // Helper function to get karat purity from order
  const getKaratPurity = (process: any): number => {
    return process.order?.selectedKarat || 92 // Default to 92% if not specified
  }
  
  // Helper function to calculate total stone pieces for STONE_SETTING processes
  const getTotalStonePieces = (process: any): number => {
    if (process.processType !== 'STONE_SETTING') return 0
    
    const adStonePieces = (process.adStonesAdded || []).reduce((sum: number, stone: any) => 
      sum + (stone.pieces || 0), 0)
    const kalesStonePieces = (process.kalesStonesAdded || []).reduce((sum: number, stone: any) => 
      sum + (stone.pieces || 0), 0)
    
    return adStonePieces + kalesStonePieces
  }

  // Calculate statistics with NaN protection
  const processes = karigar.processes || []
  const totalJobs = processes.length
  
  // Filter processes based on search query and filters
  const filteredProcesses = processes.filter(process => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const orderName = process.order?.orderName?.toLowerCase() || ''
      const orderNumber = process.order?.orderNumber?.toLowerCase() || ''
      const orderId = process.order?.id?.toLowerCase() || ''
      const customerName = process.order?.customer?.name?.toLowerCase() || ''
      const processType = process.processType?.toLowerCase().replace('_', ' ') || ''
      
      const matchesSearch = (
        orderName.includes(query) ||
        orderNumber.includes(query) ||
        orderId.includes(query) ||
        customerName.includes(query) ||
        processType.includes(query)
      )
      
      if (!matchesSearch) return false
    }
    
    // Karat filter
    if (filters.karat !== 'all') {
      const processKarat = getKaratPurity(process)
      let requiredKarat = 92
      if (filters.karat === '18k') requiredKarat = 75.5
      else if (filters.karat === '19.2k') requiredKarat = 80
      else if (filters.karat === '20k') requiredKarat = 84
      else if (filters.karat === '22k') requiredKarat = 92
      else if (filters.karat === '14.2k' || filters.karat === '14k') requiredKarat = 59
      else if (filters.karat === '9k') requiredKarat = 37.5
      
      if (processKarat !== requiredKarat) return false
    }
    
    // Recovery status filter - using collective logic instead of individual
    // We'll calculate the collective status for the current filter set and apply it to all matching orders
    
    // Only apply recovery status filter if it's specifically selected (not 'all')
    if (filters.recoveryStatus !== 'all') {
      // For recovery status filtering, we need to calculate collective status for the entire group
      // This will be done after we have all filtered processes, so for now we'll skip this filter
      // and handle it in a post-processing step below
    }
    
    // Date filter - single date selection
    if (filters.selectedDate) {
      const processDate = new Date(process.createdAt)
      const selectedDate = new Date(filters.selectedDate)
      
      // Check if process was created on the selected date
      const processDateOnly = processDate.toDateString()
      const selectedDateOnly = selectedDate.toDateString()
      
      if (processDateOnly !== selectedDateOnly) return false
    }
    
    return true
  })
  
  // Apply collective recovery status filtering
  let finalFilteredProcesses = filteredProcesses
  if (filters.recoveryStatus !== 'all') {
    // Calculate collective recovery status for the current filtered set
    const collectiveTotalLoss = filteredProcesses.reduce((sum, p) => sum + (p.goldLoss || 0), 0)
    const collectiveTotalRecovered = filteredProcesses.reduce((sum, p) => sum + (p.goldRecovered || 0), 0)
    const collectiveMakingCharge = filteredProcesses.reduce((sum, p) => sum + (p.karigarMakingCharge || 0), 0)
    const collectiveNewTotalLoss = Math.max(0, collectiveTotalLoss - collectiveMakingCharge)
    const collectivePending = Math.max(0, collectiveNewTotalLoss - collectiveTotalRecovered)
    
    // Determine collective status
    let collectiveStatus
    if (collectivePending <= 0 && collectiveTotalRecovered > 0) {
      collectiveStatus = 'fully_recovered'
    } else if (collectiveTotalRecovered > 0 && collectivePending > 0) {
      collectiveStatus = 'partially_recovered'
    } else {
      collectiveStatus = 'pending'
    }
    
    // Debug logging
    console.log('🔍 Collective Recovery Status Check:', {
      filteredOrdersCount: filteredProcesses.length,
      collectiveTotalLoss,
      collectiveMakingCharge,
      collectiveTotalRecovered,
      collectiveNewTotalLoss,
      collectivePending,
      calculatedCollectiveStatus: collectiveStatus,
      filterRequested: filters.recoveryStatus,
      shouldShow: collectiveStatus === filters.recoveryStatus
    })
    
    // Show all orders if collective status matches filter, otherwise show none
    if (collectiveStatus !== filters.recoveryStatus) {
      finalFilteredProcesses = [] // Hide all orders if collective status doesn't match filter
    }
  }
  
  // Use finalFilteredProcesses instead of filteredProcesses for the rest of the component
  const displayProcesses = finalFilteredProcesses
  
  // Calculate statistics by karat purity dynamically
  const statsByKarat: Record<number, { input: number, output: number, loss: number, recovered: number, makingCharge: number, count: number }> = {}
  
  // Process all karigar processes to calculate stats by karat (using ALL processes for overall stats)
  karigar.processes?.forEach(process => {
    const karat = getKaratPurity(process)
    if (!statsByKarat[karat]) {
      statsByKarat[karat] = { input: 0, output: 0, loss: 0, recovered: 0, makingCharge: 0, count: 0 }
    }
    const stats = statsByKarat[karat]
    stats.input += safeNumber(process.inputWeight)
    stats.output += safeNumber(process.outputWeight) 
    stats.loss += safeNumber(process.goldLoss)
    stats.recovered += safeNumber(process.goldRecovered)
    stats.makingCharge += safeNumber(process.karigarMakingCharge)
    stats.count += 1
  })
  
  // Calculate filtered statistics for display totals dynamically
  const filteredStatsByKarat: Record<number, { input: number, output: number, loss: number, recovered: number, count: number }> = {}
  
  // Process display processes to calculate filtered stats
  displayProcesses.forEach(process => {
    const karat = getKaratPurity(process)
    if (!filteredStatsByKarat[karat]) {
      filteredStatsByKarat[karat] = { input: 0, output: 0, loss: 0, recovered: 0, count: 0 }
    }
    const stats = filteredStatsByKarat[karat]
    stats.input += safeNumber(process.inputWeight)
    stats.output += safeNumber(process.outputWeight) 
    stats.loss += safeNumber(process.goldLoss)
    stats.recovered += safeNumber(process.goldRecovered)
    stats.count += 1
  })
  
  // Calculate totals for backward compatibility
  const totalGoldLoss = Object.values(statsByKarat).reduce((sum, stats) => sum + stats.loss, 0)
  const totalRecovered = Object.values(statsByKarat).reduce((sum, stats) => sum + stats.recovered, 0)
  const totalInputWeight = Object.values(statsByKarat).reduce((sum, stats) => sum + stats.input, 0)
  const totalOutputWeight = Object.values(statsByKarat).reduce((sum, stats) => sum + stats.output, 0)
  
  const totalPending = Math.max(0, totalGoldLoss - totalRecovered) // Ensure non-negative
  const ordersWithPendingRecovery = new Set(
    (karigar.processes || [])
      .filter(p => ((p.goldLoss || 0) - (p.goldRecovered || 0)) > 0)
      .map(p => p.order?.id)
      .filter(id => id)
  ).size

  const getRecoveryStatus = (process: any) => {
    const goldRecovered = process.goldRecovered || 0
    const goldLoss = process.goldLoss || 0
    const makingCharge = process.karigarMakingCharge || 0
    const adminRecoverable = Math.max(0, goldLoss - makingCharge)
    const netPending = Math.max(0, adminRecoverable - goldRecovered)
    
    if (netPending <= 0 && goldRecovered > 0) {
      return { status: 'Fully Recovered', className: 'bg-green-100 text-green-800' }
    }
    if (goldRecovered > 0 && netPending > 0) {
      return { status: 'Partially Recovered', className: 'bg-yellow-100 text-yellow-800' }
    }
    return { status: 'Pending Recovery', className: 'bg-red-100 text-red-800' }
  }

  // Calculate bulk making charge and actual recoverable amounts
  const bulkMakingCharge = safeNumber(karigar.bulkMakingCharge)
  const actualRecoverable = Math.max(0, totalGoldLoss - bulkMakingCharge - totalRecovered)
  
  // Group processes by type for recovery schedule display
  const processByType = (karigar.processes || []).reduce((acc, process) => {
    if (!acc[process.processType]) {
      acc[process.processType] = []
    }
    acc[process.processType]!.push(process)
    return acc
  }, {} as Record<string, NonNullable<typeof karigar.processes>>)

  const getRecoverySchedule = (processType: string) => {
    if (processType === 'FILING' || processType === 'STONE_SETTING') {
      return 'Weekly'
    } else if (processType === 'FINAL_POLISH') {
      return 'Monthly'
    }
    return 'As needed'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/karigars"
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{karigar.name}</h1>
                <p className="text-gray-600">Work History & Gold Recovery</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Specialty: {karigar.specialty || 'General'}</p>
            <p className="text-sm text-gray-600">Phone: {karigar.phone || 'N/A'}</p>
            <p className="text-sm text-gray-600">Joined: {new Date(karigar.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Total Orders and Stone Pieces Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Total Orders Card */}
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-3xl font-bold text-blue-600">{totalJobs}</p>
            <p className="text-sm font-medium text-gray-600">Total Orders Worked</p>
          </div>
          
          {/* Total Stone Pieces Card */}
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {(() => {
                const stoneSettingProcesses = processes.filter(p => p.processType === 'STONE_SETTING')
                const totalStonePieces = stoneSettingProcesses.reduce((total, process) => {
                  const adPieces = (process.adStonesAdded || []).reduce((sum: number, stone: any) => sum + (stone.pieces || 0), 0)
                  const kalesPieces = (process.kalesStonesAdded || []).reduce((sum: number, stone: any) => sum + (stone.pieces || 0), 0)
                  return total + adPieces + kalesPieces
                }, 0)
                return totalStonePieces > 0 ? totalStonePieces.toString() : '0'
              })()} 💎
            </div>
            <p className="text-sm font-medium text-gray-600 mb-3">Total Stone Pieces</p>
            
            {/* Stone breakdown */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-2 rounded">
                  <p className="font-semibold text-blue-600">
                    {(() => {
                      const totalAD = processes.filter(p => p.processType === 'STONE_SETTING')
                        .reduce((total, process) => {
                          return total + (process.adStonesAdded || []).reduce((sum: number, stone: any) => sum + (stone.pieces || 0), 0)
                        }, 0)
                      return totalAD > 0 ? totalAD.toString() : '0'
                    })()}
                  </p>
                  <p className="text-gray-600">AD Stones</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="font-semibold text-purple-600">
                    {(() => {
                      const totalKales = processes.filter(p => p.processType === 'STONE_SETTING')
                        .reduce((total, process) => {
                          return total + (process.kalesStonesAdded || []).reduce((sum: number, stone: any) => sum + (stone.pieces || 0), 0)
                        }, 0)
                      return totalKales > 0 ? totalKales.toString() : '0'
                    })()}
                  </p>
                  <p className="text-gray-600">Kales Stones</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                From {processes.filter(p => p.processType === 'STONE_SETTING').length} stone setting orders
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Karat-wise Gold Loss & Recovery Summary */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>⚖️</span> Karat-wise Gold Loss & Recovery Summary
        </h3>
        
        {Object.keys(statsByKarat).length === 0 ? (
          <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-150">
            No karat work history recorded for this karigar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(statsByKarat)
              .sort(([karatA], [karatB]) => Number(karatB) - Number(karatA)) // Sort high purity to low
              .map(([karatKey, stats]) => {
                const karatPurity = Number(karatKey)
                // Get display name (e.g. "22k (92%)" or "18k (75.5%)")
                let displayLabel = `${karatPurity}%`
                if (karatPurity === 92) displayLabel = '22k (92%)'
                else if (karatPurity === 88) displayLabel = '21.1k (88%)'
                else if (karatPurity === 84) displayLabel = '20k (84%)'
                else if (karatPurity === 80) displayLabel = '19.2k (80%)'
                else if (karatPurity === 76) displayLabel = '18.2k (76%)'
                else if (karatPurity === 75.5) displayLabel = '18k (75.5%)'
                else if (karatPurity === 75) displayLabel = '18k (75%)'
                else if (karatPurity === 59) displayLabel = '14.2k (59%)'
                else if (karatPurity === 37.5) displayLabel = '9k (37.5%)'
                
                const karatLabel = displayLabel.split(' ')[0]
                
                const totalLoss = stats.loss
                const totalRecovered = stats.recovered
                const totalMakingCharge = stats.makingCharge
                const netPending = Math.max(0, totalLoss - totalMakingCharge - totalRecovered)
                
                const isFullyRecovered = netPending <= 0 && totalRecovered > 0
                const hasNoLoss = totalLoss === 0
                
                return (
                  <div 
                    key={karatKey} 
                    className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between bg-surface"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                          {displayLabel}
                        </span>
                        {hasNoLoss ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            No Loss
                          </span>
                        ) : isFullyRecovered ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            ✓ Recovered
                          </span>
                        ) : netPending > 0 ? (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            ⚠️ Pending
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            Settled
                          </span>
                        )}
                      </div>
                      
                      {/* Pending Gold Display */}
                      <div className="my-4">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Net Pending Loss</p>
                        <p className={`text-2xl font-black ${netPending > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {netPending.toFixed(3)}g
                        </p>
                      </div>
                      
                      {/* Breakdown Table */}
                      <div className="space-y-1.5 text-sm border-t border-gray-100 pt-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Loss:</span>
                          <span className="font-medium text-gray-900">{totalLoss.toFixed(3)}g</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Making Charge:</span>
                          <span className="font-medium text-gray-900">{totalMakingCharge.toFixed(3)}g</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Already Recovered:</span>
                          <span className="font-medium text-gray-900">{totalRecovered.toFixed(3)}g</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-dashed border-gray-100">
                          <span>Total Orders:</span>
                          <span>{stats.count}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Button */}
                    <div className="mt-5">
                      <button
                        onClick={() => handleOpenKaratRecovery(karatPurity, karatLabel, stats, netPending)}
                        disabled={netPending <= 0 || processingRecovery}
                        className={`w-full py-2 px-4 rounded-lg font-bold text-sm transition-all transform hover:scale-[1.02] flex items-center justify-center gap-1.5 ${
                          netPending <= 0 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed hover:scale-100'
                            : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg'
                        }`}
                      >
                        <span>💰</span> Record Recovery
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Filters and Totals Section */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">🔍 Order Filters & Analysis</h3>
          <button
            onClick={() => {
              setSearchQuery('')
              setFilters({
                karat: 'all',
                recoveryStatus: 'all',
                selectedDate: ''
              })
            }}
            className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md font-medium"
          >
            Clear All Filters
          </button>
        </div>
        
        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Karat Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Karat Type
            </label>
            <select
              value={filters.karat}
              onChange={(e) => setFilters({...filters, karat: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Karats</option>
              <option value="22k">22k (92%)</option>
              <option value="20k">20k (84%)</option>
              <option value="19.2k">19.2k (80%)</option>
              <option value="18k">18k (75.5%)</option>
              <option value="14.2k">14.2k (59%)</option>
              <option value="9k">9k (37.5%)</option>
            </select>
          </div>
          
          {/* Recovery Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recovery Status
            </label>
            <select
              value={filters.recoveryStatus}
              onChange={(e) => setFilters({...filters, recoveryStatus: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="fully_recovered">Fully Recovered</option>
              <option value="partially_recovered">Partially Recovered</option>
              <option value="pending">Pending Recovery</option>
            </select>
          </div>
          
          {/* Single Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Date
            </label>
            <input
              type="date"
              value={filters.selectedDate}
              onChange={(e) => setFilters({...filters, selectedDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Select specific date"
            />
            <p className="text-xs text-gray-500 mt-1">
              Show orders processed on selected date
            </p>
          </div>
        </div>
        
        {/* Date-specific Summary - Show when a date is selected */}
        {filters.selectedDate && displayProcesses.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6 mb-6">
            <h4 className="text-lg font-semibold text-green-900 mb-4">
              📅 {new Date(filters.selectedDate).toLocaleDateString()} - Daily Summary
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Orders Count */}
              <div className="bg-white p-4 rounded-lg text-center border border-green-200">
                <p className="text-2xl font-bold text-blue-600">
                  {displayProcesses.length}
                </p>
                <p className="text-sm font-medium text-gray-600">Orders Processed</p>
                <p className="text-xs text-gray-500">on this date</p>
              </div>
              
              {/* Total Loss */}
              <div className="bg-white p-4 rounded-lg text-center border border-green-200">
                <p className="text-2xl font-bold text-red-600">
                  {Object.values(filteredStatsByKarat).reduce((sum, stats) => sum + stats.loss, 0).toFixed(3)}g
                </p>
                <p className="text-sm font-medium text-gray-600">Total Loss</p>
                <p className="text-xs text-gray-500">before making charge</p>
              </div>
              
              {/* Making Charge Applied */}
              <div className="bg-white p-4 rounded-lg text-center border border-green-200">
                <p className="text-2xl font-bold text-orange-600">
                  {(() => {
                    const totalMakingCharge = displayProcesses.reduce((sum, process) => {
                      return sum + safeNumber(process.karigarMakingCharge || 0)
                    }, 0)
                    return totalMakingCharge.toFixed(3)
                  })()}g
                </p>
                <p className="text-sm font-medium text-gray-600">Making Charge</p>
                <p className="text-xs text-gray-500">karigar keeps</p>
              </div>
              
              {/* Net Pending */}
              <div className="bg-white p-4 rounded-lg text-center border border-green-200">
                <p className="text-2xl font-bold text-purple-600">
                  {(() => {
                    const totalLoss = Object.values(filteredStatsByKarat).reduce((sum, stats) => sum + stats.loss, 0)
                    const totalMakingCharge = displayProcesses.reduce((sum, process) => sum + safeNumber(process.karigarMakingCharge || 0), 0)
                    const totalRecovered = Object.values(filteredStatsByKarat).reduce((sum, stats) => sum + stats.recovered, 0)
                    const netPending = Math.max(0, totalLoss - totalMakingCharge - totalRecovered)
                    return netPending.toFixed(3)
                  })()}g
                </p>
                <p className="text-sm font-medium text-gray-600">Net Pending</p>
                <p className="text-xs text-gray-500">to be recovered</p>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-sm text-green-700">
                📊 <strong>Formula:</strong> Net Pending = Total Loss - Making Charge - Already Recovered
              </p>
            </div>
          </div>
        )}
        
        {/* Bottom Totals & Recovery - Only show when specific karat is selected */}
        {filters.karat !== 'all' && displayProcesses.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-blue-900 mb-4">📊 {filters.karat} Orders Summary</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Total Input */}
              <div className="bg-white p-4 rounded-lg text-center border border-blue-200">
                <p className="text-2xl font-bold text-blue-600">
                  {Object.values(filteredStatsByKarat).reduce((sum, stats) => sum + stats.input, 0).toFixed(3)}g
                </p>
                <p className="text-sm font-medium text-gray-600">Total Input Weight</p>
                <p className="text-xs text-gray-500">{displayProcesses.length} orders</p>
              </div>
              
              {/* Total Output */}
              <div className="bg-white p-4 rounded-lg text-center border border-blue-200">
                <p className="text-2xl font-bold text-green-600">
                  {Object.values(filteredStatsByKarat).reduce((sum, stats) => sum + stats.output, 0).toFixed(3)}g
                </p>
                <p className="text-sm font-medium text-gray-600">Total Output Weight</p>
                <p className="text-xs text-gray-500">After processing</p>
              </div>
              
              {/* Total Loss */}
              <div className="bg-white p-4 rounded-lg text-center border border-blue-200">
                <p className="text-2xl font-bold text-red-600">
                  {Object.values(filteredStatsByKarat).reduce((sum, stats) => sum + stats.loss, 0).toFixed(3)}g
                </p>
                <p className="text-sm font-medium text-gray-600">Total Loss</p>
                <p className="text-xs text-gray-500">Manufacturing loss</p>
              </div>
            </div>
            
            {/* Recovery Button */}
            <div className="text-center">
              <button 
                onClick={handleOpenEnhancedRecovery}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-lg"
              >
                💰 Start Recovery Process
              </button>
              <p className="text-sm text-gray-600 mt-2">
                Recover loss from {displayProcesses.length} {filters.karat} orders
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              📋 Order Details ({totalJobs} total orders)
            </h3>
            <div className="text-sm text-gray-600">
              {displayProcesses.length !== totalJobs && (
                <span className="text-blue-600 font-medium">
                  Showing {displayProcesses.length} of {totalJobs} orders
                </span>
              )}
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Search by order name, customer name, process type, or order number..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Image
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Info
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Process & Karat
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Input Weight
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Output Weight
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loss
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayProcesses.map((process, index) => {
                const makingCharge = process.karigarMakingCharge || 0
                const actualLoss = Math.max(0, (process.goldLoss || 0) - makingCharge)
                
                return (
                  <tr key={process.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {/* Order Image */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg relative overflow-hidden">
                        <OrderImage
                          src={process.order?.orderPhoto}
                          alt={process.order?.orderName || 'Order'}
                          orderName={process.order?.orderName || 'Unknown Order'}
                        />
                      </div>
                    </td>
                    
                    {/* Order Info */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{process.order?.orderName || 'N/A'}</div>
                        <div className="text-gray-500">
                          {process.order?.orderNumber ? (
                            <span className="font-medium text-blue-600">#{process.order.orderNumber}</span>
                          ) : (
                            <span>#{process.order?.id.slice(-8) || 'N/A'}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Step #{process.sequence || 1}
                        </div>
                      </div>
                    </td>
                    
                    {/* Customer */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{process.order?.customer?.name || 'N/A'}</div>
                        <div className="text-gray-500 text-xs">{process.order?.customer?.phone || ''}</div>
                      </div>
                    </td>
                    
                    {/* Process & Karat */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {process.processType.replace('_', ' ')}
                        </span>
                        <div className="text-xs text-gray-600">
                          {getKaratPurity(process) === 92 ? '22k (92%)' : 
                           getKaratPurity(process) === 75.5 ? '18k (75.5%)' : 
                           getKaratPurity(process) === 80 ? '19.2k (80%)' : 
                           `${getKaratPurity(process)}%`}
                        </div>
                        {/* Show stone pieces for STONE_SETTING processes */}
                        {process.processType === 'STONE_SETTING' && getTotalStonePieces(process) > 0 && (
                          <div className="text-xs font-medium">
                            <div className="flex items-center space-x-1">
                              <span className="text-purple-600">💎</span>
                              <span className="text-purple-700">{getTotalStonePieces(process)} pieces</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {(process.adStonesAdded || []).length > 0 && `AD: ${(process.adStonesAdded || []).reduce((sum: number, stone: any) => sum + (stone.pieces || 0), 0)} pcs`}
                              {(process.adStonesAdded || []).length > 0 && (process.kalesStonesAdded || []).length > 0 && ' | '}
                              {(process.kalesStonesAdded || []).length > 0 && `Kales: ${(process.kalesStonesAdded || []).reduce((sum: number, stone: any) => sum + (stone.pieces || 0), 0)} pcs`}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Input Weight */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium text-blue-600">
                        {(process.inputWeight || 0) > 0 ? Number(process.inputWeight || 0).toFixed(3) : '0.000'}g
                      </div>
                    </td>
                    
                    {/* Output Weight */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium text-green-600">
                        {(process.outputWeight || 0) > 0 ? Number(process.outputWeight || 0).toFixed(3) : '0.000'}g
                      </div>
                    </td>
                    
                    {/* Loss */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium text-red-600">
                        {(process.goldLoss || 0) > 0 ? Number(process.goldLoss || 0).toFixed(3) : '0.000'}g
                      </div>
                    </td>
                    
                    {/* Collective Recovery Status */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        // Calculate collective recovery status for all displayed orders
                        const collectiveTotalLoss = displayProcesses.reduce((sum, p) => sum + (p.goldLoss || 0), 0)
                        const collectiveTotalRecovered = displayProcesses.reduce((sum, p) => sum + (p.goldRecovered || 0), 0)
                        const collectiveMakingCharge = displayProcesses.reduce((sum, p) => sum + (p.karigarMakingCharge || 0), 0)
                        const collectiveNewTotalLoss = Math.max(0, collectiveTotalLoss - collectiveMakingCharge)
                        const collectivePending = Math.max(0, collectiveNewTotalLoss - collectiveTotalRecovered)
                        
                        // Determine status based on collective recovery
                        let status, className
                        if (collectivePending <= 0 && collectiveTotalRecovered > 0) {
                          status = 'Fully Recovered'
                          className = 'bg-green-100 text-green-800'
                        } else if (collectiveTotalRecovered > 0 && collectivePending > 0) {
                          status = 'Partially Recovered'
                          className = 'bg-yellow-100 text-yellow-800'
                        } else {
                          status = 'Pending Recovery'
                          className = 'bg-red-100 text-red-800'
                        }
                        
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
                            {status}
                          </span>
                        )
                      })()} 
                    </td>
                    
                    {/* Date */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(process.createdAt).toLocaleDateString()}
                    </td>
                    
                    {/* Actions */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditProcess(process)}
                        className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
                        title="Edit Process Details"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {/* No results message */}
        {displayProcesses.length === 0 && totalJobs > 0 && searchQuery && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500">No orders match your search</p>
            <p className="text-sm text-gray-400 mt-2">
              Try searching for order name, customer name, or process type
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear search
            </button>
          </div>
        )}
        
        {totalJobs === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔧</div>
            <p className="text-gray-500">No orders worked yet</p>
          </div>
        )}
      </div>

      {/* Simple Loss Recovery Modal */}
      <SimpleLossRecoveryModal
        isOpen={simpleRecoveryModal.isOpen}
        onClose={handleCloseSimpleRecovery}
        onSubmit={handleSimpleRecoverySubmit}
        processData={simpleRecoveryModal.processData}
        karigarName={karigar.name}
        isLoading={processingRecovery}
      />
      
      {/* Enhanced Recovery Modal */}
      <EnhancedRecoveryModal
        isOpen={enhancedRecoveryModal.isOpen}
        onClose={handleCloseEnhancedRecovery}
        onSubmit={handleEnhancedRecoverySubmit}
        karigarName={karigar.name}
        filteredData={enhancedRecoveryModal.filteredData}
        isLoading={processingRecovery}
      />
      
      {/* Process Edit Modal */}
      <ProcessEditModal
        isOpen={editProcessModal.isOpen}
        onClose={handleCloseEditProcess}
        onSubmit={handleEditProcessSubmit}
        process={editProcessModal.process}
        isLoading={processingEdit}
      />

    </div>
  )
}

export default KarigarWorkHistoryPage
