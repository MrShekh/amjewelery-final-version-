import { useState, useEffect, useCallback } from 'react'
import { apiService } from '../services/apiService'

interface AdvanceGoldData {
  availableAdvanceGold: number
  orderAdvanceGold: number
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Custom hook for fetching advance gold data
 * Combines inventory advance gold and order-specific advance gold in a single request
 */
export const useAdvanceGold = (orderId?: string): AdvanceGoldData => {
  const [availableAdvanceGold, setAvailableAdvanceGold] = useState(0)
  const [orderAdvanceGold, setOrderAdvanceGold] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAdvanceGold = useCallback(async () => {
    if (!loading) setLoading(true)
    setError(null)

    try {
      // Prepare batch requests
      const requests = ['/inventory']
      if (orderId) {
        requests.push(`/orders/${orderId}`)
      }

      // Batch fetch for efficiency
      const responses = await apiService.batchGet(requests)
      const [inventoryResponse, orderResponse] = responses

      // Extract available advance gold from inventory
      const inventoryData = (inventoryResponse as any)?.success ? (inventoryResponse as any).data : inventoryResponse
      setAvailableAdvanceGold((inventoryData as any)?.inventory?.advanceCustomerStock || 0)

      // Extract order advance gold if available
      if (orderResponse && orderId) {
        const orderData = (orderResponse as any)?.order || orderResponse
        const advanceAmount = parseFloat((orderData as any)?.customerAdvanceGold || 0)
        setOrderAdvanceGold(advanceAmount)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch advance gold data'
      setError(errorMessage)
      console.error('Error fetching advance gold:', errorMessage)
      
      // Set default values on error
      setAvailableAdvanceGold(0)
      setOrderAdvanceGold(0)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchAdvanceGold()
  }, [fetchAdvanceGold])

  return {
    availableAdvanceGold,
    orderAdvanceGold,
    loading,
    error,
    refetch: fetchAdvanceGold
  }
}

/**
 * Lightweight hook for just inventory advance gold
 * Use when you don't need order-specific data
 */
export const useInventoryAdvanceGold = () => {
  const [availableAdvanceGold, setAvailableAdvanceGold] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInventoryAdvanceGold = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiService.getInventory()
      const inventoryData = (response as any)?.success ? (response as any).data : response
      setAvailableAdvanceGold((inventoryData as any)?.inventory?.advanceCustomerStock || 0)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch inventory advance gold'
      setError(errorMessage)
      setAvailableAdvanceGold(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventoryAdvanceGold()
  }, [fetchInventoryAdvanceGold])

  return {
    availableAdvanceGold,
    loading,
    error,
    refetch: fetchInventoryAdvanceGold
  }
}
