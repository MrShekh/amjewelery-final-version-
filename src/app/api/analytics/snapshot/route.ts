import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsSnapshotsCollection, getUsersCollection, getOrdersCollection } from '@/lib/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'
import { calculateKarigarLossByKarat, calculateFinishedGoodsByKarat } from '@/lib/karigar-loss'

// ─── Auth helper ─────────────────────────────────────────────────────────────
async function authenticate(request: NextRequest) {
    const token = extractTokenFromHeader(request.headers.get('authorization'))
    if (!token) return null
    try {
        const payload = verifyToken(token)
        const usersCol = await getUsersCollection()
        const user = await usersCol.findOne({ _id: new ObjectId(payload.userId), isActive: true })
        if (!user || user.email !== payload.email) return null
        return user
    } catch {
        return null
    }
}

// GET /api/analytics/snapshot — returns the latest clearedAt timestamp (or null) + stock baselines
export async function GET(request: NextRequest) {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const col = await getAnalyticsSnapshotsCollection()
    const latest = await col.findOne({}, { sort: { clearedAt: -1 } })

    return NextResponse.json({
        clearedAt: latest?.clearedAt ?? null,
        savedBy: latest?.savedBy ?? null,
        stockBaselineByKarat: latest?.stockBaselineByKarat ?? null,
    })
}

// Numeric register fields snapshotted per-order, so Analytics (see /api/orders GET) can net each
// order's CURRENT value against what it was at the moment of the reset - same field set the register
// itself edits (see numericFields in /api/orders/[id] PUT).
const ANALYTICS_NUMERIC_FIELDS = ['fillingIn', 'fillingOut', 'fillingLoss', 'settingLoss', 'ad', 'klStone', 'polishLoss', 'finishWeight', 'makingCharge'] as const

// POST /api/analytics/snapshot — records a new clear date, AND snapshots baselines from every order
// that exists right now: per-karat stock baselines (In-Process, Finished Goods Awaiting Bill, Karigar
// Loss) for the Dashboard, and per-order field baselines for Analytics. This is what makes "start
// fresh" work correctly everywhere: rather than excluding old ORDERS outright (which would wrongly
// hide brand-new activity - e.g. Filling In entered today - on an order that merely happened to be
// created earlier), we freeze the CURRENT value as a baseline and net live totals against it going
// forward. An order with nothing recorded yet contributes 0 to the baseline, so anything entered on
// it after this point shows up in full, exactly like a real new order would.
export async function POST(request: NextRequest) {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const now = new Date()
    const col = await getAnalyticsSnapshotsCollection()
    const ordersCol = await getOrdersCollection()

    const allOrders = await ordersCol.find({}, {
        projection: {
            fillingIn: 1, fillingOut: 1, fillingLoss: 1, settingLoss: 1, ad: 1, klStone: 1,
            polishLoss: 1, finishWeight: 1, makingCharge: 1, selectedKarat: 1, status: 1
        }
    }).toArray()
    const isFinalized = (o: any) => o.status === 'COMPLETED' || o.status === 'DELIVERED'
    const inProcessOrders = allOrders.filter((o: any) => !isFinalized(o))
    const finalizedOrders = allOrders.filter(isFinalized)
    const completedNotBilledOrders = allOrders.filter((o: any) => o.status === 'COMPLETED')

    const toFlatMap = (byKarat: Record<string, { rawLoss?: number; weight?: number }>) => {
        const flat: Record<string, number> = {}
        Object.entries(byKarat).forEach(([key, entry]) => {
            flat[key] = entry.rawLoss ?? entry.weight ?? 0
        })
        return flat
    }

    const stockBaselineByKarat = {
        inProcess: toFlatMap(calculateKarigarLossByKarat(inProcessOrders as any)),
        finishedGoods: toFlatMap(calculateFinishedGoodsByKarat(completedNotBilledOrders as any)),
        karigarLoss: toFlatMap(calculateKarigarLossByKarat(finalizedOrders as any)),
    }

    // Only snapshot FINALIZED orders (COMPLETED / DELIVERED).
    // In-progress orders intentionally get NO snapshot entry so their baseline
    // defaults to 0 in the analytics net calculation. This means:
    //   • An order finished BEFORE this clear → fully excluded from the new period ✅
    //   • An order in-progress AT clear time → carries over in full to the new
    //     period, and its eventual karigar loss is counted correctly ✅
    //   • A brand-new order created AFTER clear → baseline 0, counted in full ✅
    const orderFieldSnapshots: Record<string, Record<string, number>> = {}
    allOrders.forEach((o: any) => {
        if (o.status !== 'COMPLETED' && o.status !== 'DELIVERED') {
            // In-progress: leave out of snapshot so it carries over to the next period
            return
        }
        const fields: Record<string, number> = {}
        ANALYTICS_NUMERIC_FIELDS.forEach((field) => {
            fields[field] = o[field] || 0
        })
        orderFieldSnapshots[o._id.toString()] = fields
    })

    await col.insertOne({
        clearedAt: now,
        savedBy: user.email,
        createdAt: now,
        stockBaselineByKarat,
        orderFieldSnapshots,
    })

    return NextResponse.json({ clearedAt: now, message: 'Analytics cleared successfully', stockBaselineByKarat })
}
