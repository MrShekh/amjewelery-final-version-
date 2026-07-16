import { NextRequest, NextResponse } from 'next/server'
import { getInventoryCollection, getUsersCollection, getOrdersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import {
    handleApiError,
    handleApiSuccess,
    AuthenticationError,
    generateRequestId
} from '@/lib/errorHandler'

export async function POST(request: NextRequest) {
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

        const userId = user._id.toString()
        const organizationId = user.organizationId

        const inventoryCol = await getInventoryCollection()
        const ordersCol = await getOrdersCollection()

        // Calculate current total loss
        const allOrders = await ordersCol.find({}, { projection: { fillingIn: 1, finishWeight: 1 } }).toArray()
        let calculatedKarigarLossStock = 0
        allOrders.forEach((o: any) => {
            const fIn = o.fillingIn || 0
            const fWeight = o.finishWeight || 0
            calculatedKarigarLossStock += Math.max(0, fIn - fWeight)
        })

        const now = new Date()
        await inventoryCol.updateOne(
            {
                $or: [
                    { userId: userId },
                    { organizationId: organizationId },
                    { _id: new ObjectId(userId) }
                ]
            },
            {
                $set: {
                    karigarLossClearedAmount: calculatedKarigarLossStock,
                    lastUpdated: now
                }
            }
        )

        return handleApiSuccess({
            message: 'Karigar total loss cleared successfully',
            clearedAmount: calculatedKarigarLossStock
        }, requestId)
    } catch (error) {
        return handleApiError(error instanceof Error ? error : new Error('Failed to clear karigar loss'), requestId)
    }
}
