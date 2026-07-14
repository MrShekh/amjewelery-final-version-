import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}

export interface JWTPayload {
  userId: string
  email: string
  role?: string
  organizationId?: string
  iat?: number
  exp?: number
}

/**
 * Generate a JWT token for user authentication
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // Token expires in 7 days
    issuer: 'gold-billing-app',
    audience: 'gold-billing-users'
  })
}

/**
 * Generate a refresh token (longer expiry)
 */
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d', // Refresh token expires in 30 days
    issuer: 'gold-billing-app',
    audience: 'gold-billing-users'
  })
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'gold-billing-app',
      audience: 'gold-billing-users'
    }) as JWTPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token')
    }
    throw new Error('Token verification failed')
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7) // Remove 'Bearer ' prefix
}

/**
 * Generate API key for service-to-service communication (optional)
 */
export function generateApiKey(identifier: string): string {
  const payload = {
    type: 'api_key',
    identifier,
    generated: new Date().toISOString()
  }
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '365d', // API keys expire in 1 year
    issuer: 'gold-billing-app',
    audience: 'gold-billing-api'
  })
}

/**
 * Verify API key
 */
export function verifyApiKey(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'gold-billing-app',
      audience: 'gold-billing-api'
    })
  } catch (error) {
    throw new Error('Invalid API key')
  }
}

/**
 * Check if token is about to expire (within next hour)
 */
export function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = jwt.decode(token) as any
    if (!payload || !payload.exp) return true
    
    const expirationTime = payload.exp * 1000 // Convert to milliseconds
    const currentTime = Date.now()
    const oneHour = 60 * 60 * 1000
    
    return (expirationTime - currentTime) < oneHour
  } catch {
    return true
  }
}

/**
 * Get token expiration date
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const payload = jwt.decode(token) as any
    if (!payload || !payload.exp) return null
    
    return new Date(payload.exp * 1000)
  } catch {
    return null
  }
}
