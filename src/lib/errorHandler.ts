import { NextResponse } from 'next/server'

export interface ErrorResponse {
  success: false
  error: string
  code: string
  timestamp: string
  requestId?: string
  details?: any
}

export interface SuccessResponse<T = any> {
  success: true
  data: T
  timestamp: string
  requestId?: string
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse

export class ApiError extends Error {
  public statusCode: number
  public code: string
  public details?: any

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.name = 'ApiError'
  }
}

// Pre-defined error types
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

export class DatabaseError extends ApiError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, 500, 'DATABASE_ERROR', details)
  }
}

export class ConnectionError extends ApiError {
  constructor(message: string = 'Database connection failed') {
    super(message, 503, 'CONNECTION_ERROR')
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}

// Generate request ID for tracing
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Error response formatter
export function formatErrorResponse(
  error: Error | ApiError,
  requestId?: string
): ErrorResponse {
  const timestamp = new Date().toISOString()
  
  if (error instanceof ApiError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      timestamp,
      requestId,
      ...(process.env.NODE_ENV === 'development' && error.details && { details: error.details })
    }
  }

  // Handle known Node.js/MongoDB errors
  if (error.message.includes('ENOTFOUND')) {
    return {
      success: false,
      error: 'Database connection failed',
      code: 'CONNECTION_ERROR',
      timestamp,
      requestId
    }
  }

  if (error.message.includes('ECONNREFUSED')) {
    return {
      success: false,
      error: 'Service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp,
      requestId
    }
  }

  if (error.message.includes('ValidationError')) {
    return {
      success: false,
      error: 'Invalid data provided',
      code: 'VALIDATION_ERROR',
      timestamp,
      requestId
    }
  }

  if (error.message.includes('CastError') || error.message.includes('ObjectId')) {
    return {
      success: false,
      error: 'Invalid ID format',
      code: 'INVALID_ID',
      timestamp,
      requestId
    }
  }

  // Default error response
  return {
    success: false,
    error: process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { details: error.stack })
  }
}

// Success response formatter
export function formatSuccessResponse<T>(
  data: T,
  requestId?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId
  }
}

// Error handler for API routes
export function handleApiError(
  error: Error | ApiError,
  requestId?: string
): NextResponse<ErrorResponse> {
  // Log error for monitoring
  console.error(`API Error [${requestId || 'unknown'}]:`, {
    message: error.message,
    stack: error.stack,
    ...(error instanceof ApiError && { code: error.code, statusCode: error.statusCode })
  })

  const errorResponse = formatErrorResponse(error, requestId)
  const statusCode = error instanceof ApiError ? error.statusCode : 500

  return NextResponse.json(errorResponse, { status: statusCode })
}

// Success handler for API routes
export function handleApiSuccess<T>(
  data: T,
  requestId?: string,
  statusCode: number = 200
): NextResponse<SuccessResponse<T>> {
  const successResponse = formatSuccessResponse(data, requestId)
  return NextResponse.json(successResponse, { status: statusCode })
}

// Async error wrapper for API routes
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const requestId = generateRequestId()
    
    try {
      return await handler(...args)
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
      
      throw apiError
    }
  }
}

// Database operation wrapper
export async function withDatabaseError<T>(
  operation: () => Promise<T>,
  context: string = 'Database operation'
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`${context} failed:`, error)
    
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        throw new ConnectionError(`${context} - connection failed`)
      }
      
      if (error.message.includes('ValidationError')) {
        throw new ValidationError(`${context} - validation failed`, error.message)
      }
      
      if (error.message.includes('CastError') || error.message.includes('ObjectId')) {
        throw new ValidationError(`${context} - invalid ID format`)
      }
    }
    
    throw new DatabaseError(`${context} failed`, error instanceof Error ? error.message : 'Unknown error')
  }
}

// Input validation helper
export function validateRequired(data: Record<string, any>, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(field => !data[field])
  
  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      { missingFields }
    )
  }
}

// MongoDB ObjectId validation
export function validateObjectId(id: string, fieldName: string = 'id'): void {
  if (!id || !id.match(/^[a-f\d]{24}$/i)) {
    throw new ValidationError(`Invalid ${fieldName} format`)
  }
}

// Rate limiting helper (basic in-memory implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60 * 1000 // 1 minute
): void {
  const now = Date.now()
  const key = identifier
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return
  }

  if (record.count >= limit) {
    throw new RateLimitError(`Rate limit exceeded. Try again in ${Math.ceil((record.resetTime - now) / 1000)} seconds`)
  }

  record.count++
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000) // Clean up every minute
