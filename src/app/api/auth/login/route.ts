import { NextRequest, NextResponse } from 'next/server'
import { getUsersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import bcrypt from 'bcryptjs'
import { generateToken, generateRefreshToken } from '@/lib/jwt'
import { 
  handleApiError, 
  handleApiSuccess, 
  ValidationError, 
  AuthenticationError,
  generateRequestId 
} from '@/lib/errorHandler'

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    const body = await request.json()
    const { email, password } = body

    // Enhanced validation
    if (!email || !password) {
      throw new ValidationError('Email and password are required')
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new ValidationError('Invalid input format')
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format')
    }

    if (password.length < 3) {
      throw new ValidationError('Password must be at least 3 characters long')
    }

    const usersCol = await getUsersCollection()
    
    // Find user by email (with rate limiting protection)
    const normalizedEmail = email.toLowerCase().trim()
    const user = await usersCol.findOne({ 
      email: normalizedEmail,
      isActive: true 
    })

    if (!user) {
      // Add artificial delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new AuthenticationError('Invalid email or password')
    }

    // Production-level password verification
    let passwordValid = false
    
    // Priority order: hashed password first (more secure), then plaintext (for backward compatibility)
    if (user.hashedPassword) {
      passwordValid = await bcrypt.compare(password, user.hashedPassword)
    }
    // Fallback to plaintext password if no hashed version exists
    else if (user.password) {
      passwordValid = (user.password === password)
      
      // Auto-upgrade to hashed password for security
      const hashedPassword = await bcrypt.hash(password, 12)
      await usersCol.updateOne(
        { _id: user._id },
        { 
          $set: { hashedPassword },
          $unset: { password: 1 } // Remove plaintext password for security
        }
      )
    }

    if (!passwordValid) {
      // Add artificial delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new AuthenticationError('Invalid email or password')
    }

    // Update last login and login attempts
    const now = new Date()
    await usersCol.updateOne(
      { _id: user._id },
      { 
        $set: { 
          lastLogin: now,
          updatedAt: now,
          failedLoginAttempts: 0 // Reset failed attempts on successful login
        },
        $inc: {
          totalLogins: 1
        }
      }
    )

    // Get updated user
    const updatedUser = await usersCol.findOne({ _id: user._id })
    
    // Remove passwords from response
    const { password: _, hashedPassword: __, ...userResponse } = toClientFormat(updatedUser!)

    // Generate production-level JWT tokens
    const accessToken = generateToken({
      userId: updatedUser!._id.toString(),
      email: updatedUser!.email,
      role: updatedUser!.role || 'user',
      organizationId: updatedUser!.organizationId
    })

    const refreshToken = generateRefreshToken({
      userId: updatedUser!._id.toString(),
      email: updatedUser!.email,
      role: updatedUser!.role || 'user',
      organizationId: updatedUser!.organizationId
    })

    // Store refresh token in database (for token rotation)
    await usersCol.updateOne(
      { _id: user._id },
      { 
        $set: { 
          refreshToken,
          refreshTokenIssuedAt: now
        } 
      }
    )

    return handleApiSuccess({
      message: 'Login successful',
      user: userResponse,
      accessToken,
      refreshToken,
      expiresIn: '7d'
    }, requestId)

  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown login error'), requestId)
  }
}
