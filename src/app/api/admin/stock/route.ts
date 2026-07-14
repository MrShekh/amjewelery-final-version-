import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization')
    let userId = null

    // Try to get user from session token (for login flow)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string }
        userId = decoded.userId
      } catch (error) {
        console.log('Token verification failed, trying alternative method')
      }
    }

    // If no userId from token, try to get from localStorage or session
    // For now, we'll get it from the request body or use a fallback
    const body = await request.json()
    const { currentStock, stockDate, type, adminId } = body

    if (currentStock == null || currentStock < 0) {
      return NextResponse.json(
        { error: 'Valid current stock amount is required' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()

    // Create admin stock entry
    const stockEntry = {
      currentStock: parseFloat(currentStock),
      stockDate: new Date(stockDate || new Date()),
      type: type || 'LOGIN_UPDATE',
      description: `Admin stock update - ${type || 'Login entry'}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: userId || adminId || 'admin' // Fallback for admin user
    }

    // Insert the stock entry
    await db.collection('adminStock').insertOne(stockEntry)

    // Update the admin's current stock in users collection if we have userId
    if (userId) {
      await db.collection('users').updateOne(
        { _id: { $oid: userId } },
        { 
          $set: { 
            currentStock: parseFloat(currentStock),
            lastStockUpdate: new Date()
          }
        }
      )
    }

    return NextResponse.json(
      { 
        message: 'Admin stock updated successfully',
        stock: stockEntry
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
    const { db } = await connectToDatabase()
    
    // Get recent admin stock entries
    const stockEntries = await db.collection('adminStock')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()

    return NextResponse.json({
      success: true,
      stockEntries
    })

  } catch (error) {
    console.error('Get admin stock error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin stock' },
      { status: 500 }
    )
  }
}
