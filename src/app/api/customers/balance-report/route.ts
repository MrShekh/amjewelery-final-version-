import { NextRequest, NextResponse } from 'next/server'
import {
    getCustomersCollection,
    getCustomerJamaBalancesCollection,
    getUsersCollection,
} from '@/lib/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'

// GET /api/customers/balance-report
// Returns every customer with their jama gold totals for the downloadable balance sheet.
export async function GET(request: NextRequest) {
    try {
        // ── Auth ──────────────────────────────────────────────────────────────────
        const authHeader = request.headers.get('authorization')
        const token = extractTokenFromHeader(authHeader)

        if (!token) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }

        let payload
        try {
            payload = verifyToken(token)
        } catch {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const usersCol = await getUsersCollection()
        const user = await usersCol.findOne({ _id: new ObjectId(payload.userId), isActive: true })

        if (!user || user.email !== payload.email) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
        }

        // ── Data ──────────────────────────────────────────────────────────────────
        const customersCol = await getCustomersCollection()
        const jamaBalancesCol = await getCustomerJamaBalancesCollection()

        // Fetch ALL customers (lightweight projection)
        const customers = await customersCol
            .find(
                {},
                { projection: { name: 1, phone: 1, email: 1 } }
            )
            .sort({ name: 1 })
            .toArray()

        // Fetch ALL jama balances in one query and group by customerId
        const allBalances = await jamaBalancesCol.find({}).toArray()

        const balanceMap: Record<
            string,
            { totalJamaGold: number; totalJamaReturned: number }
        > = {}

        for (const bal of allBalances) {
            const cid = bal.customerId
            if (!balanceMap[cid]) {
                balanceMap[cid] = { totalJamaGold: 0, totalJamaReturned: 0 }
            }
            balanceMap[cid].totalJamaGold +=
                bal.goldBalance ?? bal.jamaGoldAmount ?? 0
            balanceMap[cid].totalJamaReturned += bal.returnedAmount ?? 0
        }

        // Build report rows
        const rows = customers.map((c) => {
            const cid = c._id.toString()
            const bals = balanceMap[cid] ?? { totalJamaGold: 0, totalJamaReturned: 0 }
            const totalJamaGold = bals.totalJamaGold
            const netPendingGold = Math.max(0, totalJamaGold - bals.totalJamaReturned)

            return {
                id: cid,
                name: c.name,
                phone: c.phone ?? '',
                email: c.email ?? '',
                totalJamaGold: parseFloat(totalJamaGold.toFixed(4)),
                netPendingGold: parseFloat(netPendingGold.toFixed(4)),
            }
        })

        // Grand totals
        const grandTotalJamaGold = parseFloat(
            rows.reduce((s, r) => s + r.totalJamaGold, 0).toFixed(4)
        )
        const grandNetPendingGold = parseFloat(
            rows.reduce((s, r) => s + r.netPendingGold, 0).toFixed(4)
        )

        return NextResponse.json({
            rows,
            totals: { grandTotalJamaGold, grandNetPendingGold },
        })
    } catch (error) {
        console.error('Error generating customer balance report:', error)
        return NextResponse.json(
            { error: 'Failed to generate balance report' },
            { status: 500 }
        )
    }
}
