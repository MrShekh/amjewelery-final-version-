import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsersCollection } from '@/lib/mongodb'
import { AdminGoldStock, AdminGoldEntry } from '@/types/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'
import { ADMIN_STOCK_KARATS, karatFieldKey } from '@/lib/admin-stock-karats'
import { fineToKarat, KaratPurity } from '@/lib/gold-conversions'

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

// POST /api/admin-stock/convert - Convert Fine Gold into a specific karat (alloying).
// This is an internal move within Admin Stock, not new gold coming in: the fine bucket goes down by
// the amount converted, and the target karat bucket goes up by its karat-weight equivalent (more
// grams than the fine amount, since diluting pure gold to a lower purity increases weight while the
// fine content stays the same). Total Admin Stock (fine) is unchanged by a conversion - it's the
// same gold, just re-expressed at a different purity.
export async function POST(request: NextRequest) {
  try {
    await requireUser(request)

    const body = await request.json()
    const { date, karat, fineAmount, description } = body

    const karatNum = parseFloat(karat)
    const fineAmountNum = parseFloat(fineAmount)

    if (!date || !fineAmountNum || fineAmountNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Date and a positive fine amount are required' },
        { status: 400 }
      )
    }

    if (!ADMIN_STOCK_KARATS.includes(karatNum as any)) {
      return NextResponse.json(
        { success: false, error: `Invalid target karat. Must be one of: ${ADMIN_STOCK_KARATS.join(', ')}` },
        { status: 400 }
      )
    }

    const { col, stock } = await getOrCreateAdminStock()
    const currentFineStock = (stock as any).fineStock || 0

    if (currentFineStock - fineAmountNum < 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient Fine Gold: have ${currentFineStock.toFixed(3)}g, tried to convert ${fineAmountNum.toFixed(3)}g`
        },
        { status: 400 }
      )
    }

    const karatWeight = fineToKarat(fineAmountNum, karatNum as KaratPurity)
    const now = new Date()
    const entryDate = new Date(date)
    const karatFieldName = karatFieldKey(karatNum)

    const fineOutEntry: AdminGoldEntry = {
      _id: new ObjectId(),
      date: entryDate,
      karat: 0,
      weight: -fineAmountNum,
      type: 'FINE_TO_KARAT',
      description: `Converted to ${karatNum}K${description ? ` — ${description}` : ''}`,
      createdAt: now
    }

    const karatInEntry: AdminGoldEntry = {
      _id: new ObjectId(),
      date: entryDate,
      karat: karatNum,
      weight: karatWeight,
      type: 'FINE_TO_KARAT',
      description: `Converted from ${fineAmountNum.toFixed(3)}g Fine${description ? ` — ${description}` : ''}`,
      createdAt: now
    }

    await col.updateOne(
      { _id: stock._id },
      {
        $inc: { fineStock: -fineAmountNum, [karatFieldName]: karatWeight },
        $set: { lastUpdated: now },
        $push: { entries: { $each: [fineOutEntry, karatInEntry] } as any }
      }
    )

    return NextResponse.json({
      success: true,
      message: `Converted ${fineAmountNum.toFixed(3)}g Fine into ${karatWeight.toFixed(3)}g of ${karatNum}K gold`,
      karatWeight
    })
  } catch (error) {
    console.error('Error converting fine to karat:', error)
    const message = error instanceof Error ? error.message : 'Failed to convert fine gold'
    const status = message === 'Authentication required' || message === 'User not found' ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
