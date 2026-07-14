import { NextRequest } from 'next/server'
import { getRecoveryHistoryCollection, getUsersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import {
  handleApiError,
  handleApiSuccess,
  AuthenticationError,
  generateRequestId
} from '@/lib/errorHandler'

// GET /api/reports/recovered-stock
// Returns total recovered stock (grams) for a given date or month
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)

    if (!token) {
      throw new AuthenticationError('Authorization token required')
    }

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

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') // Expected format: YYYY-MM-DD
    const monthParam = searchParams.get('month') // Expected format: YYYY-MM

    // Determine date range based on provided filter
    const now = new Date()
    let startDate: Date
    let endDate: Date

    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-')
      const year = Number(yearStr)
      const month = Number(monthStr) || 1
      startDate = new Date(Date.UTC(year, month - 1, 1, -5, -30))
      endDate = new Date(Date.UTC(year, month, 1, -5, -30))
    } else if (dateParam) {
      const [year, month, day] = dateParam.split('-').map(Number)
      startDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1, -5, -30))
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    } else {
      const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
      startDate = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), -5, -30))
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    }

    const recoveryHistoryCol = await getRecoveryHistoryCollection()

    // Match either by actual createdAt or the explicitly backdated/forward-dated selectedDate
    // The selectedDate is a String 'YYYY-MM-DD', so if dateParam exists we match it exactly,
    // and if monthParam exists we match startsWith.
    const dateQuery: any = { createdAt: { $gte: startDate, $lt: endDate } }
    
    const baseMatch: any = {
      $or: [
        dateQuery
      ]
    }

    if (dateParam) {
      baseMatch.$or.push({ selectedDate: dateParam })
    } else if (monthParam) {
      baseMatch.$or.push({ selectedDate: { $regex: `^${monthParam}` } })
    }

    const aggregation = await recoveryHistoryCol
      .aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalRecovered: { 
              $sum: { 
                $ifNull: [
                  '$actualRecoveryAmount', 
                  { $ifNull: ['$actualRecoveredAmountKarat', { $ifNull: ['$actualRecovery', '$recoveredAmount'] }] }
                ] 
              } 
            },
            count: { $sum: 1 }
          }
        }
      ])
      .toArray()

    const totalRecovered = aggregation[0]?.totalRecovered || 0
    const count = aggregation[0]?.count || 0

    return handleApiSuccess(
      {
        date: startDate,
        totalRecovered,
        count
      },
      requestId
    )
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown recovered stock report error'), requestId)
  }
}
