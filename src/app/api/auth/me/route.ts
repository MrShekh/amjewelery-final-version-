import { NextRequest, NextResponse } from 'next/server'
import { getUsersCollection, getOrganizationsCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { 
  handleApiError, 
  handleApiSuccess, 
  AuthenticationError,
  ValidationError,
  generateRequestId 
} from '@/lib/errorHandler'

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      throw new AuthenticationError('Authorization token required')
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      throw new AuthenticationError(error instanceof Error ? error.message : 'Invalid token')
    }

    const usersCol = await getUsersCollection()
    const orgsCol = await getOrganizationsCollection()
    
    // Find user by JWT payload user ID
    const user = await usersCol.findOne({ 
      _id: new ObjectId(payload.userId),
      isActive: true 
    })

    if (!user) {
      throw new AuthenticationError('User not found or session expired')
    }

    // Verify email matches token (additional security check)
    if (user.email !== payload.email) {
      throw new AuthenticationError('Token validation failed')
    }

    // Get organization info if user has one
    let organization = null
    if (user.organizationId) {
      try {
        organization = await orgsCol.findOne({ _id: new ObjectId(user.organizationId) })
        if (organization) {
          organization = toClientFormat(organization)
        }
      } catch (error) {
        console.warn('Failed to fetch organization:', error)
        // Continue without organization data
      }
    }

    // Remove passwords from response
    const { password: _, hashedPassword: __, refreshToken: ___, ...userResponse } = toClientFormat(user)

    return handleApiSuccess({
      user: userResponse,
      organization: organization,
      tokenExpiry: payload.exp ? new Date(payload.exp * 1000) : null
    }, requestId)

  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown profile error'), requestId)
  }
}

// Update user profile
export async function PUT(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      throw new AuthenticationError('Authorization token required')
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      throw new AuthenticationError(error instanceof Error ? error.message : 'Invalid token')
    }

    const body = await request.json()
    const { firstName, lastName, email, phone } = body

    const usersCol = await getUsersCollection()
    
    // Validate input if provided
    if (email && typeof email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format')
      }
    }
    
    if (phone && typeof phone === 'string') {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
      if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        throw new ValidationError('Invalid phone number format')
      }
    }
    
    // Find and update user
    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    if (firstName && typeof firstName === 'string') updateFields.firstName = firstName.trim()
    if (lastName && typeof lastName === 'string') updateFields.lastName = lastName.trim()
    if (email && typeof email === 'string') {
      const normalizedEmail = email.toLowerCase().trim()
      // Check if email is already taken by another user
      const existingUser = await usersCol.findOne({ 
        email: normalizedEmail, 
        _id: { $ne: new ObjectId(payload.userId) } 
      })
      if (existingUser) {
        throw new ValidationError('Email is already taken by another user')
      }
      updateFields.email = normalizedEmail
    }
    if (phone && typeof phone === 'string') updateFields.phone = phone.trim()

    const result = await usersCol.updateOne(
      { _id: new ObjectId(payload.userId), isActive: true },
      { $set: updateFields }
    )

    if (result.matchedCount === 0) {
      throw new AuthenticationError('User not found or session expired')
    }

    // Get updated user
    const updatedUser = await usersCol.findOne({ _id: new ObjectId(payload.userId) })
    const { password: _, hashedPassword: __, refreshToken: ___, ...userResponse } = toClientFormat(updatedUser!)

    return handleApiSuccess({
      message: 'Profile updated successfully',
      user: userResponse
    }, requestId)

  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown update error'), requestId)
  }
}
