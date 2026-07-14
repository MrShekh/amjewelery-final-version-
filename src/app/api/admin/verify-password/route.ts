import { NextRequest, NextResponse } from 'next/server'
import { getUsersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

// Developer-set admin password for stock updates
const ADMIN_STOCK_PASSWORD = 'admin@123' // Change this to your desired password

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Get user from JWT session token to ensure they're authenticated
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the JWT token
    let tokenPayload
    try {
      tokenPayload = verifyToken(token)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({ 
      _id: new ObjectId(tokenPayload.userId),
      isActive: true 
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found or not authenticated' },
        { status: 401 }
      )
    }

    // Check if user has admin/owner role
    if (!user.role || (user.role !== 'owner' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      )
    }

    // Verify against developer-set password
    if (password !== ADMIN_STOCK_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid admin stock password. Contact developer if you need the correct password.' },
        { status: 401 }
      )
    }

    // Password is valid, generate a temporary verification token
    const verificationToken = `admin_${user._id}_${Date.now()}`

    return NextResponse.json({
      success: true,
      message: 'Admin stock password verified',
      verificationToken: verificationToken,
      adminName: `${user.firstName} ${user.lastName}`
    })

  } catch (error) {
    console.error('Admin password verification error:', error)
    return NextResponse.json(
      { error: 'Failed to verify admin password' },
      { status: 500 }
    )
  }
}
