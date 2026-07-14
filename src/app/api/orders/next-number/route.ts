import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getUsersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { 
  handleApiError, 
  handleApiSuccess, 
  AuthenticationError,
  generateRequestId 
} from '@/lib/errorHandler'

// GET /api/orders/next-number - Get the next order number
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
    const user = await usersCol.findOne({ 
      _id: new ObjectId(payload.userId),
      isActive: true 
    })

    if (!user) {
      throw new AuthenticationError('User not found or session expired')
    }

    // Generate next order number
    const ordersCol = await getOrdersCollection()
    
    // Get all existing order numbers to find the highest numeric one
    const allOrders = await ordersCol.find(
      { orderNumber: { $exists: true, $ne: null } },
      { projection: { orderNumber: 1 }, sort: { createdAt: -1 } }
    ).toArray()
    
    let nextNumber = 118 // Start from 118
    
    if (allOrders && allOrders.length > 0) {
      let highestNumeric = 0
      let highestBag = 0
      
      // Process all order numbers to find the highest numeric and bag numbers
      for (const order of allOrders) {
        if (order.orderNumber) {
          // Check for numeric format (118, 119, etc.)
          const numericMatch = order.orderNumber.match(/^(\d+)$/)
          if (numericMatch) {
            const num = parseInt(numericMatch[1])
            if (num > highestNumeric) {
              highestNumeric = num
            }
          }
          
          // Check for old bag format (bag01, bag02, etc.)
          const bagMatch = order.orderNumber.match(/^bag(\d+)$/)
          if (bagMatch) {
            const bagNum = parseInt(bagMatch[1])
            if (bagNum > highestBag) {
              highestBag = bagNum
            }
          }
        }
      }
      
      // Determine next number based on highest found
      if (highestNumeric > 0) {
        // We have numeric orders, increment from highest numeric
        nextNumber = highestNumeric + 1
      } else if (highestBag > 0) {
        // Only old bag format orders exist, convert to new format
        nextNumber = Math.max(118, 117 + highestBag) // Convert bag01 -> 118, bag02 -> 119, etc.
      }
      // If neither found, use default 118
    }
    
    // Use simple numeric format (118, 119, 120, etc.)
    const nextOrderNumber = nextNumber.toString()

    return handleApiSuccess({ nextOrderNumber }, requestId)
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown error'), requestId)
  }
}
