import { NextRequest } from 'next/server'
import { getBillsCollection, getUsersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import {
  handleApiError,
  handleApiSuccess,
  AuthenticationError,
  generateRequestId
} from '@/lib/errorHandler'

// GET /api/reports/manual-making-charge
// Returns total manual making charge (grams) for a given date (per admin / organization)
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
    const dateParam = searchParams.get('date') // Expected format: YYYY-MM-DD (single day)
    const monthParam = searchParams.get('month') // Expected format: YYYY-MM (whole month)

    // Determine date range based on provided filter
    const now = new Date()
    let startDate: Date
    let endDate: Date

    if (monthParam) {
      // Monthly range: from 1st of month to 1st of next month (IST)
      const [yearStr, monthStr] = monthParam.split('-')
      const year = Number(yearStr)
      const month = Number(monthStr) || 1
      startDate = new Date(Date.UTC(year, month - 1, 1, -5, -30))
      endDate = new Date(Date.UTC(year, month, 1, -5, -30))
    } else if (dateParam) {
      // Daily range: specific day in IST timezone
      const [year, month, day] = dateParam.split('-').map(Number)
      startDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1, -5, -30))
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    } else {
      // Default to today in IST
      const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
      startDate = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), -5, -30))
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    }

    const billsCol = await getBillsCollection()

    // Limit to current user / organization
    const baseMatch: any = {
      createdAt: { $gte: startDate, $lt: endDate },
      $or: [
        { userId: user._id.toString() },
        { organizationId: user.organizationId }
      ]
    }

    // Only consider bills where manualMakingChargeGrams is present and > 0
    baseMatch['billing.manualMakingChargeGrams'] = { $gt: 0 }

    const aggregation = await billsCol
      .aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalManualMakingChargeGrams: { $sum: '$billing.manualMakingChargeGrams' },
            billCount: { $sum: 1 }
          }
        }
      ])
      .toArray()

    const totalManualMakingChargeGrams = aggregation[0]?.totalManualMakingChargeGrams || 0
    const billCount = aggregation[0]?.billCount || 0

    return handleApiSuccess(
      {
        date: startDate,
        totalManualMakingChargeGrams,
        billCount
      },
      requestId
    )
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown manual making charge report error'), requestId)
  }
}
