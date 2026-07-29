import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsSnapshotsCollection, getUsersCollection } from '@/lib/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'

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

// GET /api/analytics/snapshot — returns the latest clearedAt timestamp (or null)
export async function GET(request: NextRequest) {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const col = await getAnalyticsSnapshotsCollection()
    const latest = await col.findOne({}, { sort: { clearedAt: -1 } })

    return NextResponse.json({
        clearedAt: latest?.clearedAt ?? null,
        savedBy: latest?.savedBy ?? null,
    })
}

// POST /api/analytics/snapshot — records a new clear date
export async function POST(request: NextRequest) {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const now = new Date()
    const col = await getAnalyticsSnapshotsCollection()

    await col.insertOne({
        clearedAt: now,
        savedBy: user.email,
        createdAt: now,
    })

    return NextResponse.json({ clearedAt: now, message: 'Analytics cleared successfully' })
}
