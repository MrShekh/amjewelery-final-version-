import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsersCollection } from '@/lib/mongodb'
import { AdminGoldStock, AdminGoldEntry } from '@/types/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'
import { ADMIN_STOCK_KARATS, karatFieldKey } from '@/lib/admin-stock-karats'

async function requireUser(request: NextRequest) {
  const token = extractTokenFromHeader(request.headers.get('authorization'))
  if (!token) throw new Error('Authentication required')
  const payload = verifyToken(token)
  const usersCol = await getUsersCollection()
  const user = await usersCol.findOne({ _id: new ObjectId(payload.userId), isActive: true })
  if (!user) throw new Error('User not found')
  return user
}

// POST /api/admin-stock/sell
// Body: { date, karat, weightSold, amountReceived, buyerName?, description? }
// karat = 0 → deduct from fineStock; any valid karat → deduct from that karat field
export async function POST(request: NextRequest) {
  try {
    await requireUser(request)

    const body = await request.json()
    const { date, karat, weightSold, amountReceived, buyerName, description } = body

    const karatNum = parseFloat(karat)
    const weightNum = parseFloat(weightSold)
    const amountNum = parseFloat(amountReceived)
    const isFine = karatNum === 0

    if (!date || isNaN(karatNum) || !weightNum || weightNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Date, karat and a positive weight are required' },
        { status: 400 }
      )
    }

    if (isNaN(amountNum) || amountNum < 0) {
      return NextResponse.json(
        { success: false, error: 'Amount received must be a non-negative number' },
        { status: 400 }
      )
    }

    if (!isFine && !ADMIN_STOCK_KARATS.includes(karatNum as any)) {
      return NextResponse.json(
        { success: false, error: `Invalid karat. Must be 0 (Fine) or one of: ${ADMIN_STOCK_KARATS.join(', ')}` },
        { status: 400 }
      )
    }

    const db = await getDb()
    const col = db.collection<AdminGoldStock>('adminGoldStock')

    let stock = await col.findOne({})
    if (!stock) {
      const now = new Date()
      const newStock: AdminGoldStock = { entries: [], lastUpdated: now, createdAt: now }
      const result = await col.insertOne(newStock as any)
      stock = { ...newStock, _id: result.insertedId }
    }

    const fieldKey = isFine ? 'fineStock' : karatFieldKey(karatNum)
    const currentStock: number = (stock as any)[fieldKey] || 0

    if (currentStock < weightNum) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient stock: have ${currentStock.toFixed(3)}g at ${isFine ? 'Fine' : `${karatNum}%`}, trying to sell ${weightNum.toFixed(3)}g`
        },
        { status: 400 }
      )
    }

    const descParts = [
      `Sold ${weightNum.toFixed(3)}g ${isFine ? 'Fine Gold' : `${karatNum}% Gold`}`,
      `@ ₹${amountNum.toLocaleString('en-IN')}`,
    ]
    if (buyerName?.trim()) descParts.push(`to ${buyerName.trim()}`)
    if (description?.trim()) descParts.push(`— ${description.trim()}`)
    const autoDescription = descParts.join(' ')

    const newEntry: AdminGoldEntry = {
      _id: new ObjectId(),
      date: new Date(date),
      karat: karatNum,
      weight: -weightNum,           // negative = stock going out
      type: 'GOLD_SOLD' as any,     // new entry type
      description: autoDescription,
      amountReceived: amountNum,    // ₹ received — stored for history display
      buyerName: buyerName?.trim() || undefined,
      createdAt: new Date(),
    } as any

    const now = new Date()
    await col.updateOne(
      { _id: stock._id },
      {
        $inc: { [fieldKey]: -weightNum },
        $set: { lastUpdated: now },
        $push: { entries: newEntry as any }
      }
    )

    return NextResponse.json({
      success: true,
      message: `Successfully sold ${weightNum.toFixed(3)}g. Stock updated.`,
      weightSold: weightNum,
      amountReceived: amountNum,
    })
  } catch (error) {
    console.error('Error recording gold sale:', error)
    const message = error instanceof Error ? error.message : 'Failed to record gold sale'
    const status = message === 'Authentication required' || message === 'User not found' ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

// GET /api/admin-stock/sell — return all GOLD_SOLD entries for the history table
export async function GET(request: NextRequest) {
  try {
    await requireUser(request)

    const db = await getDb()
    const col = db.collection<AdminGoldStock>('adminGoldStock')
    const stock = await col.findOne({})

    const soldEntries = ((stock?.entries || []) as any[])
      .filter((e: any) => e.type === 'GOLD_SOLD')
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ success: true, data: soldEntries })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch gold sales'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
