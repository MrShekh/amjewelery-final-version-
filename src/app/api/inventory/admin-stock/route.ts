import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, getUsersCollection } from '@/lib/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'

export async function PUT(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({ 
      _id: new ObjectId(payload.userId),
      isActive: true 
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Verify email matches token
    if (user.email !== payload.email) {
      return NextResponse.json({ error: 'Token validation failed' }, { status: 401 })
    }

    const body = await request.json()
    const { adminStock } = body

    if (adminStock === undefined || adminStock < 0) {
      return NextResponse.json(
        { error: 'Valid admin stock amount is required' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const userId = user._id.toString()
    const organizationId = user.organizationId

    // Update or create inventory record with new admin stock for this user
    const result = await db.collection('inventory').updateOne(
      {
        $or: [
          { userId: userId },
          { organizationId: organizationId },
          { _id: new ObjectId(userId) } // Fallback for existing data
        ]
      },
      { 
        $set: { 
          userId: userId,
          organizationId: organizationId,
          adminStock: parseFloat(adminStock),
          lastUpdated: new Date()
        },
        $setOnInsert: {
          karigarStock: 0,
          customerStock: 0,
          createdAt: new Date()
        }
      },
      { upsert: true } // Create if doesn't exist
    )

    return NextResponse.json(
      { 
        message: 'Admin stock updated successfully',
        adminStock: parseFloat(adminStock)
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Admin stock update error:', error)
    return NextResponse.json(
      { error: 'Failed to update admin stock' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({ 
      _id: new ObjectId(payload.userId),
      isActive: true 
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    const userId = user._id.toString()
    const organizationId = user.organizationId
    
    // Get current inventory for this user
    const inventory = await db.collection('inventory').findOne({
      $or: [
        { userId: userId },
        { organizationId: organizationId },
        { _id: new ObjectId(userId) } // Fallback for existing data
      ]
    })

    return NextResponse.json({
      success: true,
      adminStock: inventory?.adminStock || 0,
      lastUpdated: inventory?.lastUpdated
    })

  } catch (error) {
    console.error('Get admin stock error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin stock' },
      { status: 500 }
    )
  }
}
