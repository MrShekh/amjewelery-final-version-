import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getUsersCollection, getBillsCollection } from '@/lib/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

export async function GET(request: Request) {
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

    const billsCollection = await getBillsCollection()

    // Find the highest bill number for this user/organization
    const lastBill = await billsCollection.findOne(
      {
        $or: [
          { userId: user._id.toString() },
          { organizationId: user.organizationId }
        ]
      },
      {
        sort: { billNo: -1 },
        projection: { billNo: 1 }
      }
    )

    let nextBillNumber = 'Bill01'
    
    if (lastBill && lastBill.billNo) {
      // Extract number from last bill (e.g., "Bill05" -> 5)
      const match = lastBill.billNo.match(/Bill(\d+)/)
      if (match) {
        const lastNumber = parseInt(match[1])
        const nextNumber = lastNumber + 1
        nextBillNumber = `Bill${nextNumber.toString().padStart(2, '0')}`
      }
    }

    return NextResponse.json({
      billNumber: nextBillNumber
    })

  } catch (error) {
    console.error('Error generating bill number:', error)
    return NextResponse.json(
      { error: 'Failed to generate bill number' },
      { status: 500 }
    )
  }
}
