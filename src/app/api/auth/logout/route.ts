import { NextRequest, NextResponse } from 'next/server'
import { getUsersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { 
  handleApiError, 
  handleApiSuccess, 
  generateRequestId 
} from '@/lib/errorHandler'

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Extract token from header
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      // Allow logout even without token (client-side cleanup)
      return handleApiSuccess({
        message: 'Logged out successfully'
      }, requestId)
    }

    // Verify token to get user info
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      // Token invalid but still allow logout
      return handleApiSuccess({
        message: 'Logged out successfully',
        note: 'Token was invalid but logout completed'
      }, requestId)
    }

    // Invalidate refresh token in database
    try {
      const usersCol = await getUsersCollection()
      
      await usersCol.updateOne(
        { _id: new ObjectId(payload.userId) },
        { 
          $unset: { 
            refreshToken: 1,
            refreshTokenIssuedAt: 1 
          },
          $set: {
            lastLogout: new Date(),
            updatedAt: new Date()
          }
        }
      )
    } catch (error) {
      console.warn('Failed to invalidate refresh token during logout:', error)
      // Don't fail logout if database update fails
    }

    return handleApiSuccess({
      message: 'Logged out successfully'
    }, requestId)

  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown logout error'), requestId)
  }
}
