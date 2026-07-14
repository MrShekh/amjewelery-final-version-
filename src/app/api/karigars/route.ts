import { NextRequest, NextResponse } from 'next/server'
import { getKarigarsCollection, getManufacturingProcessesCollection, getUsersCollection } from '@/lib/mongodb'
import { Karigar, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

// GET /api/karigars - Get all karigars
export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({ 
      _id: new ObjectId(payload.userId),
      isActive: true 
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Verify email matches token
    if (user.email !== payload.email) {
      return NextResponse.json({ error: 'Token validation failed' }, { status: 401 })
    }

    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    
    // 1) Load all karigars (typically small list)
    const karigars = await karigarsCol.find({}).sort({ createdAt: -1 }).toArray()

    if (karigars.length === 0) {
      return NextResponse.json({ karigars: [] })
    }

    // 2) Load all processes for these karigars in ONE query
    const karigarIds = karigars.map(k => k._id.toString())

    const allProcesses = await processesCol.find(
      { karigarId: { $in: karigarIds } },
      {
        projection: {
          _id: 1,
          karigarId: 1,
          processType: 1,
          goldLoss: 1,
          goldRecovered: 1,
          karigarMakingCharge: 1,
          isFullyRecovered: 1,
          adminRecoverable: 1,
          createdAt: 1,
          orderId: 1,
        }
      }
    ).toArray()

    // 3) Group processes by karigarId (we only need count on frontend)
    const processesByKarigar: Record<string, any[]> = {}
    for (const process of allProcesses) {
      const kId = process.karigarId
      if (!kId) continue
      if (!processesByKarigar[kId]) {
        processesByKarigar[kId] = []
      }
      processesByKarigar[kId].push(process)
    }

    // 4) Attach processes array (minimal info) to each karigar
    const karigarsWithProcesses = karigars.map((karigar) => {
      const kId = karigar._id.toString()
      const processes = processesByKarigar[kId] || []

      return {
        ...toClientFormat(karigar),
        processes: processes.map((p) => ({
          ...toClientFormat(p),
          // For the karigars list we only need count, so keep order minimal
          order: null,
        })),
      }
    })

    return NextResponse.json({ karigars: karigarsWithProcesses })
  } catch (error) {
    console.error('Error fetching karigars:', error)
    return NextResponse.json(
      { error: 'Failed to fetch karigars' },
      { status: 500 }
    )
  }
}

// POST /api/karigars - Create a new karigar
export async function POST(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({ 
      _id: new ObjectId(payload.userId),
      isActive: true 
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Verify email matches token
    if (user.email !== payload.email) {
      return NextResponse.json({ error: 'Token validation failed' }, { status: 401 })
    }

    const body = await request.json()
    const { name, phone, specialty } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Karigar name is required' },
        { status: 400 }
      )
    }

    const karigarsCol = await getKarigarsCollection()
    
    // Check for existing phone
    if (phone) {
      const existingKarigar = await karigarsCol.findOne({ phone })
      if (existingKarigar) {
        return NextResponse.json(
          { error: 'Phone already exists' },
          { status: 400 }
        )
      }
    }

    const now = new Date()
    const karigarDoc: Karigar = {
      name,
      phone: phone || undefined,
      specialty: specialty || undefined,
      createdAt: now,
      updatedAt: now
    }

    const result = await karigarsCol.insertOne(karigarDoc)
    const karigar = await karigarsCol.findOne({ _id: result.insertedId })

    return NextResponse.json({ karigar: toClientFormat(karigar!) }, { status: 201 })
  } catch (error) {
    console.error('Error creating karigar:', error)
    
    return NextResponse.json(
      { error: 'Failed to create karigar' },
      { status: 500 }
    )
  }
}
