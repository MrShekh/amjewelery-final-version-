/**
 * Utility functions for making authenticated API requests
 */

/**
 * Get the current session token from localStorage
 */
export const getSessionToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sessionToken')
  }
  return null
}

/**
 * Make an authenticated GET request
 */
export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const sessionToken = getSessionToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }
  
  return fetch(url, {
    ...options,
    headers
  })
}

/**
 * Make an authenticated POST request
 */
export const authenticatedPost = async (url: string, body: any, options: RequestInit = {}): Promise<Response> => {
  return authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options
  })
}

/**
 * Make an authenticated PUT request
 */
export const authenticatedPut = async (url: string, body: any, options: RequestInit = {}): Promise<Response> => {
  return authenticatedFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
    ...options
  })
}

/**
 * Make an authenticated DELETE request
 */
export const authenticatedDelete = async (url: string, options: RequestInit = {}): Promise<Response> => {
  return authenticatedFetch(url, {
    method: 'DELETE',
    ...options
  })
}

/**
 * Handle API response with error handling
 */
export const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json()
}
