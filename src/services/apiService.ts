/**
 * Centralized API Service
 * Handles authentication, error handling, and consistent API calls
 */

interface ApiResponse<T> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

class ApiService {
  private baseUrl = '/api'

  private getSessionToken(): string | null {
    return localStorage.getItem('sessionToken')
  }

  private getHeaders(): HeadersInit {
    const sessionToken = this.getSessionToken()
    return {
      'Content-Type': 'application/json',
      'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Handle different API response formats
    if (data.success === false) {
      throw new Error(data.error || 'API request failed')
    }
    
    return data
  }

  async get<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders()
      })
      return this.handleResponse<T>(response)
    } catch (error) {
      console.error(`GET ${endpoint} failed:`, error)
      throw error
    }
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      })
      return this.handleResponse<T>(response)
    } catch (error) {
      console.error(`POST ${endpoint} failed:`, error)
      throw error
    }
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      })
      return this.handleResponse<T>(response)
    } catch (error) {
      console.error(`PUT ${endpoint} failed:`, error)
      throw error
    }
  }

  async delete<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      })
      return this.handleResponse<T>(response)
    } catch (error) {
      console.error(`DELETE ${endpoint} failed:`, error)
      throw error
    }
  }

  // Specific API methods for common operations
  async getOrder(orderId: string) {
    return this.get(`/orders/${orderId}`)
  }

  async getInventory() {
    return this.get('/inventory')
  }

  async createBill(data: any) {
    return this.post('/bills', data)
  }

  async createOrderBill(orderId: string, data: any) {
    return this.post(`/orders/${orderId}/bill`, data)
  }

  async generateBillNumber() {
    return this.get('/bills/generate-bill-number')
  }

  // Batch operations for efficiency
  async batchGet(endpoints: string[]) {
    try {
      const promises = endpoints.map(endpoint => this.get(endpoint))
      return Promise.all(promises)
    } catch (error) {
      console.error('Batch GET operation failed:', error)
      throw error
    }
  }
}

// Export singleton instance
export const apiService = new ApiService()

// Export types for use in components
export type { ApiResponse }
