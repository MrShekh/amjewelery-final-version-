import { NextRequest, NextResponse } from 'next/server'
import { getUsersCollection, getOrganizationsCollection } from '@/lib/mongodb'
import { User, Organization, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'
import { generateToken, generateRefreshToken } from '@/lib/jwt'
import { 
  handleApiError, 
  handleApiSuccess, 
  ValidationError, 
  generateRequestId,
  checkRateLimit 
} from '@/lib/errorHandler'

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Rate limiting for registration (prevent abuse)
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    checkRateLimit(`register:${clientIp}`, 5, 60 * 60 * 1000) // 5 registrations per hour per IP

    const body = await request.json()
    const {
      email,
      password,
      firstName,
      lastName,
      organizationName,
      phone,
      role = 'owner' // Default to owner for registration
    } = body

    // Enhanced validation
    if (!email || !password || !firstName || !lastName) {
      throw new ValidationError('Email, password, first name, and last name are required')
    }

    // Validate input types
    if (typeof firstName !== 'string' || typeof lastName !== 'string' || 
        typeof email !== 'string' || typeof password !== 'string') {
      throw new ValidationError('Invalid input format')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format')
    }

    // Production-level password validation
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long')
    }
    
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new ValidationError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    }

    // Validate name lengths
    if (firstName.length < 2 || lastName.length < 2) {
      throw new ValidationError('First name and last name must be at least 2 characters long')
    }

    // Validate phone if provided
    if (phone && typeof phone === 'string') {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
      if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        throw new ValidationError('Invalid phone number format')
      }
    }

    const usersCol = await getUsersCollection()
    const orgsCol = await getOrganizationsCollection()

    // Check if user already exists
    const normalizedEmail = email.toLowerCase().trim()
    const existingUser = await usersCol.findOne({ email: normalizedEmail })
    if (existingUser) {
      throw new ValidationError('An account with this email already exists')
    }

    const now = new Date()
    
    // Create organization (always create for new registrations)
    const businessName = organizationName || `${firstName} ${lastName}'s Business`
    
    const orgDoc: Organization = {
      name: businessName,
      planType: 'free',
      maxUsers: 3,
      maxOrders: 100,
      subscriptionStatus: 'active',
      subscriptionEnds: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year trial
      createdAt: now,
      updatedAt: now
    }
    
    const orgResult = await orgsCol.insertOne(orgDoc)
    const organizationId = orgResult.insertedId.toString()

    // Hash password with high security (only store hashed version)
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // Create user with production-level security
    const userDoc: User = {
      organizationId,
      email: normalizedEmail,
      hashedPassword, // Only store hashed password for security
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      businessName: businessName,
      phone: phone?.trim(),
      role,
      isActive: true,
      emailVerified: false, // For future email verification
      failedLoginAttempts: 0,
      totalLogins: 0,
      createdAt: now,
      updatedAt: now
    }

    const userResult = await usersCol.insertOne(userDoc)
    const userId = userResult.insertedId.toString()

    // Update organization with owner user ID
    await orgsCol.updateOne(
      { _id: orgResult.insertedId },
      { $set: { ownerId: userId } }
    )

    // Get created user and organization
    const createdUser = await usersCol.findOne({ _id: userResult.insertedId })
    const createdOrg = await orgsCol.findOne({ _id: orgResult.insertedId })
    const { hashedPassword: _, ...userResponse } = toClientFormat(createdUser!)

    // Generate JWT tokens for immediate login
    const accessToken = generateToken({
      userId: userId,
      email: normalizedEmail,
      role: role,
      organizationId: organizationId
    })

    const refreshToken = generateRefreshToken({
      userId: userId,
      email: normalizedEmail,
      role: role,
      organizationId: organizationId
    })

    // Store refresh token
    await usersCol.updateOne(
      { _id: userResult.insertedId },
      { 
        $set: { 
          refreshToken,
          refreshTokenIssuedAt: now
        } 
      }
    )

    return handleApiSuccess({
      message: 'Registration successful',
      user: userResponse,
      organization: toClientFormat(createdOrg!),
      accessToken,
      refreshToken,
      expiresIn: '7d'
    }, requestId, 201)

  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown registration error'), requestId)
  }
}
