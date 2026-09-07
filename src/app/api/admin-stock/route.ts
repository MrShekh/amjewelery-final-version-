import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsersCollection } from '@/lib/mongodb'
import { AdminGoldStock, AdminGoldEntry } from '@/types/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'
import { ADMIN_STOCK_KARATS, karatFieldKey, calculateAdminFineTotal, getAdminKaratBreakdown } from '@/lib/admin-stock-karats'

async function requireUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = extractTokenFromHeader(authHeader)
  if (!token) throw new Error('Authentication required')

  const payload = verifyToken(token)
  const usersCol = await getUsersCollection()
  const user = await usersCol.findOne({ _id: new ObjectId(payload.userId), isActive: true })
  if (!user) throw new Error('User not found')
  return user
}

async function getOrCreateAdminStock() {
  const db = await getDb()
  const col = db.collection<AdminGoldStock>('adminGoldStock')

  let stock = await col.findOne({})
  if (!stock) {
    const now = new Date()
    const newStock: AdminGoldStock = {
      entries: [],
      lastUpdated: now,
      createdAt: now
    }
    const result = await col.insertOne(newStock as any)
    stock = { ...newStock, _id: result.insertedId }
  }
  return { col, stock }
}

// GET - Fetch admin gold stock (karat-wise) + fine total
export async function GET(request: NextRequest) {
  try {
    await requireUser(request)

    const { stock } = await getOrCreateAdminStock()
    const { _id, ...rest } = stock

    const breakdown = getAdminKaratBreakdown(rest as any)
    const fineTotal = calculateAdminFineTotal(rest as any)

    return NextResponse.json({
      success: true,
      data: {
        ...rest,
        id: _id!.toString(),
        breakdown,
        fineTotal
      }
    })
  } catch (error) {
    console.error('Error fetching admin stock:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch admin stock'
    const status = message === 'Authentication required' || message === 'User not found' ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

// POST - Add a manual entry (gold added or given out), for a specific karat OR as direct fine gold
// (karat = 0 is the established sentinel for "not tied to a karat" - see AdminGoldEntry, and matches
// how CUSTOMER_GOLD_RECOVERED entries already credit fineStock in customers/[id]/jama-gold/route.ts)
export async function POST(request: NextRequest) {
  try {
    await requireUser(request)

    const body = await request.json()
    const { date, karat, weight, direction, description } = body

    const karatNum = parseFloat(karat)
    const weightNum = parseFloat(weight)
    const isFine = karatNum === 0

    if (!date || isNaN(karatNum) || !weightNum || weightNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Date, karat, and a positive weight are required' },
        { status: 400 }
      )
    }

    if (!isFine && !ADMIN_STOCK_KARATS.includes(karatNum as any)) {
      return NextResponse.json(
        { success: false, error: `Invalid karat. Must be 0 (Fine) or one of: ${ADMIN_STOCK_KARATS.join(', ')}` },
        { status: 400 }
      )
    }

    if (direction !== 'ADD' && direction !== 'REMOVE') {
      return NextResponse.json(
        { success: false, error: "Direction must be 'ADD' or 'REMOVE'" },
        { status: 400 }
      )
    }

    const { col, stock } = await getOrCreateAdminStock()
    const signedWeight = direction === 'REMOVE' ? -weightNum : weightNum

    const newEntry: AdminGoldEntry = {
      _id: new ObjectId(),
      date: new Date(date),
      karat: karatNum,
      weight: signedWeight,
      type: 'MANUAL',
      description,
      createdAt: new Date()
    }

    const fieldKey = isFine ? 'fineStock' : karatFieldKey(karatNum)
    const now = new Date()

    await col.updateOne(
      { _id: stock._id },
      {
        $inc: { [fieldKey]: signedWeight },
        $set: { lastUpdated: now },
        $push: { entries: newEntry as any }
      }
    )

    return NextResponse.json({ success: true, message: 'Admin stock updated successfully' })
  } catch (error) {
    console.error('Error adding admin stock entry:', error)
    const message = error instanceof Error ? error.message : 'Failed to update admin stock'
    const status = message === 'Authentication required' || message === 'User not found' ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
