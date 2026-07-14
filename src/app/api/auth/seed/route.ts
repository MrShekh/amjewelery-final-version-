import { NextRequest, NextResponse } from 'next/server'
import { getUsersCollection, getOrganizationsCollection } from '@/lib/mongodb'
import { User, Organization } from '@/types/mongodb'
import bcrypt from 'bcryptjs'
import { 
  handleApiError, 
  handleApiSuccess, 
  ValidationError,
  generateRequestId 
} from '@/lib/errorHandler'

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Only allow in development mode for security
    if (process.env.NODE_ENV === 'production') {
      throw new ValidationError('Seed endpoint is only available in development mode')
    }

    const usersCol = await getUsersCollection()
    const orgsCol = await getOrganizationsCollection()

    // Check if admin user already exists
    const existingUser = await usersCol.findOne({ email: 'admin@amjewellers.com' })
    if (existingUser) {
      return handleApiSuccess({
        message: 'Admin user already exists',
        credentials: {
          email: 'admin@amjewellers.com',
          password: 'Admin@123!',
          note: 'Updated to production-level password'
        }
      }, requestId)
    }

    const now = new Date()
    
    // Create organization
    const orgDoc: Organization = {
      name: 'AM Jewellers',
      planType: 'professional',
      maxUsers: 10,
      maxOrders: 1000,
      subscriptionStatus: 'active',
      subscriptionEnds: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
      createdAt: now,
      updatedAt: now
    }
    
    const orgResult = await orgsCol.insertOne(orgDoc)
    const organizationId = orgResult.insertedId.toString()

    // Create admin user with production-level security
    const hashedPassword = await bcrypt.hash('Admin@123!', 12)
    
    const userDoc: User = {
      organizationId,
      email: 'admin@amjewellers.com',
      hashedPassword, // Only store hashed password for security
      firstName: 'Admin',
      lastName: 'User',
      businessName: 'AM Jewellers',
      role: 'owner',
      isActive: true,
      emailVerified: true, // Mark as verified for admin
      failedLoginAttempts: 0,
      totalLogins: 0,
      createdAt: now,
      updatedAt: now
    }

    const userResult = await usersCol.insertOne(userDoc)
    const userId = userResult.insertedId.toString()

    // Update organization with owner ID
    await orgsCol.updateOne(
      { _id: orgResult.insertedId },
      { $set: { ownerId: userId } }
    )

    return handleApiSuccess({
      message: 'Admin user created successfully',
      credentials: {
        email: 'admin@amjewellers.com',
        password: 'Admin@123!',
        note: 'Production-level password with special characters'
      },
      user: {
        id: userId,
        email: 'admin@amjewellers.com',
        firstName: 'Admin',
        lastName: 'User',
        businessName: 'AM Jewellers',
        role: 'owner'
      },
      organization: {
        id: organizationId,
        name: 'AM Jewellers',
        planType: 'professional'
      }
    }, requestId, 201)

  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown seed error'), requestId)
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      throw new ValidationError('Seed endpoint is only available in development mode')
    }

    const usersCol = await getUsersCollection()
    
    // Check if admin user exists
    const existingAdmin = await usersCol.findOne({ email: 'admin@amjewellers.com' })
    
    if (existingAdmin) {
      return handleApiSuccess({
        message: 'Admin user exists',
        credentials: {
          email: 'admin@amjewellers.com',
          password: 'Admin@123!',
          note: 'Use these credentials to login'
        },
        user: {
          id: existingAdmin._id.toString(),
          email: existingAdmin.email,
          firstName: existingAdmin.firstName,
          lastName: existingAdmin.lastName,
          businessName: existingAdmin.businessName,
          role: existingAdmin.role
        }
      }, requestId)
    } else {
      return handleApiSuccess({
        message: 'Admin user does not exist',
        note: 'Send a POST request to this endpoint to create admin user'
      }, requestId)
    }

  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown seed error'), requestId)
  }
}
