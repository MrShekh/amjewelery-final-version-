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
        const monthParam = searchParams.get('month') // Expected format: YYYY-MM

        if (!monthParam) {
            return NextResponse.json(
                { error: 'Month parameter is required' },
                { status: 400 }
            )
        }

        const [yearStr, monthStr] = monthParam.split('-')
        const year = Number(yearStr)
        const month = Number(monthStr) || 1
        const startDate = new Date(Date.UTC(year, month - 1, 1, -5, -30))
        const endDate = new Date(Date.UTC(year, month, 1, -5, -30))

        const ordersCol = await getOrdersCollection()

        // Query orders created in the selected month
        const orders = await ordersCol.find({
            createdAt: { $gte: startDate, $lt: endDate }
        }, {
            projection: { fillingIn: 1, finishWeight: 1 }
        }).toArray()

        let totalLoss = 0
        orders.forEach((o: any) => {
            const fIn = o.fillingIn || 0
            const fWeight = o.finishWeight || 0
            totalLoss += Math.max(0, fIn - fWeight)
        })

        return handleApiSuccess({
            month: monthParam,
            totalLoss: parseFloat(totalLoss.toFixed(3)),
            count: orders.length
        }, requestId)
    } catch (error) {
        return handleApiError(error instanceof Error ? error : new Error('Failed to fetch karigar loss report'), requestId)
    }
}
