import { NextRequest, NextResponse } from 'next/server'
import { getInventoryCollection, getUsersCollection, getOrdersCollection, getDb, getAnalyticsSnapshotsCollection } from '@/lib/mongodb'
import { AdminGoldStock, AdminGoldEntry } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { calculateKarigarLossByKarat, combineByKaratBaselines } from '@/lib/karigar-loss'
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

        const inventoryFilter = {
            $or: [
                { userId: userId },
                { organizationId: organizationId },
                { _id: new ObjectId(userId) }
            ]
        }
        const inventory = await inventoryCol.findOne(inventoryFilter)

        // Calculate current total loss (raw, drives the Dashboard card).
        // Only COMPLETED/DELIVERED orders count as realized loss - an order still in process just
        // has gold sitting with the karigar (tracked separately as "Karigar Stock (In Process)"),
        // it hasn't actually been lost yet, so it isn't something to "recover" here.
        const allOrders = await ordersCol.find({}, { projection: { fillingIn: 1, finishWeight: 1, selectedKarat: 1, status: 1 } }).toArray()
        const finalizedOrders = allOrders.filter((o: any) => o.status === 'COMPLETED' || o.status === 'DELIVERED')
        let calculatedKarigarLossStock = 0
        finalizedOrders.forEach((o: any) => {
            const fIn = o.fillingIn || 0
            const fWeight = o.finishWeight || 0
            calculatedKarigarLossStock += Math.max(0, fIn - fWeight)
        })

        // Fine-gold equivalent, per karat (same formula/source as Analytics) - drives Total Stock.
        // The amount newly recovered per karat = live raw loss for that karat minus whatever was
        // already cleared for it before. That recovered gold physically came back, so it gets
        // credited into Admin Stock for that exact karat - Total Stock stays conserved instead of
        // just vanishing.
        //
        // Also fold in the "start fresh" reset baseline (see /api/analytics/snapshot) - loss that was
        // already written off by a reset was never claimed to be physically recovered, so it must not
        // ALSO be credited into Admin Stock here just because this button gets clicked afterward.
        const snapshotsCol = await getAnalyticsSnapshotsCollection()
        const latestSnapshot = await snapshotsCol.findOne({}, { sort: { clearedAt: -1 } })
        const karigarLossResetBaseline: Record<string, number> = latestSnapshot?.stockBaselineByKarat?.karigarLoss || {}

        const karigarLossByKarat = calculateKarigarLossByKarat(finalizedOrders as any)
        const previousClearedByKarat: Record<string, number> = inventory?.karigarLossClearedByKarat || {}
        const effectiveClearedByKarat = combineByKaratBaselines(previousClearedByKarat, karigarLossResetBaseline)
        const newClearedByKarat: Record<string, number> = { ...previousClearedByKarat }
        const recoveredByKarat: { key: string; karat: number; amount: number }[] = []

        Object.entries(karigarLossByKarat).forEach(([key, { karat, rawLoss }]) => {
            const alreadyCleared = effectiveClearedByKarat[key] || 0
            // Clamp at 0: if this karat was over-cleared before (e.g. its orders got deleted after
            // clearing, so rawLoss dropped below what was already cleared), there is nothing left to
            // recover - crediting a negative amount here would incorrectly remove gold from Admin Stock.
            const recovered = Math.max(0, parseFloat((rawLoss - alreadyCleared).toFixed(3)))
            newClearedByKarat[key] = rawLoss
            if (recovered !== 0) {
                recoveredByKarat.push({ key, karat, amount: recovered })
            }
        })

        const now = new Date()
        await inventoryCol.updateOne(
            inventoryFilter,
            {
                $set: {
                    karigarLossClearedAmount: calculatedKarigarLossStock,
                    karigarLossClearedByKarat: newClearedByKarat,
                    lastUpdated: now
                }
            }
        )

        // Credit the recovered karat gold into Admin Stock
        if (recoveredByKarat.length > 0) {
            const db = await getDb()
            const adminStockCollection = db.collection<AdminGoldStock>('adminGoldStock')

            let adminStock = await adminStockCollection.findOne({})
            if (!adminStock) {
                const newStock: AdminGoldStock = { entries: [], lastUpdated: now, createdAt: now }
                const result = await adminStockCollection.insertOne(newStock as any)
                adminStock = { ...newStock, _id: result.insertedId }
            }

            const incFields: Record<string, number> = {}
            const newEntries: AdminGoldEntry[] = recoveredByKarat.map(({ key, karat, amount }) => {
                incFields[key] = (incFields[key] || 0) + amount
                return {
                    _id: new ObjectId(),
                    date: now,
                    karat,
                    weight: amount,
                    type: 'KARIGAR_LOSS_RECOVERED',
                    description: 'Recovered from karigar loss (Clear Total Loss)',
                    createdAt: now
                }
            })

            await adminStockCollection.updateOne(
                { _id: adminStock._id },
                {
                    $inc: incFields,
                    $set: { lastUpdated: now },
                    $push: { entries: { $each: newEntries as any } }
                }
            )
        }

        return handleApiSuccess({
            message: 'Karigar total loss cleared successfully',
            clearedAmount: calculatedKarigarLossStock,
            recoveredByKarat
        }, requestId)
    } catch (error) {
        return handleApiError(error instanceof Error ? error : new Error('Failed to clear karigar loss'), requestId)
    }
}
