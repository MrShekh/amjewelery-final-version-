import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// PUT /api/karigars/[id]/bulk-making-charge - Set bulk making charge for entire karigar
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await connectToDatabase()
    const resolvedParams = await params
    const karigarId = resolvedParams.id
    const body = await request.json()
    
    const { makingChargeAmount, description } = body

    if (makingChargeAmount === undefined || makingChargeAmount < 0) {
      return NextResponse.json(
        { error: 'Valid makingChargeAmount is required' },
        { status: 400 }
      )
    }

    // Check if karigar exists
    const karigar = await db.collection('karigars').findOne({ 
      _id: new ObjectId(karigarId) 
    })

    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }

    // Get all processes for this karigar to calculate total loss
    const processes = await db.collection('processes')
      .find({ 
        karigarId: karigarId,
        goldLoss: { $gt: 0 } // Only processes with actual loss
      })
      .toArray()

    if (processes.length === 0) {
      return NextResponse.json(
        { error: 'No processes with loss found for this karigar' },
        { status: 404 }
      )
    }

    // Calculate total loss for this karigar with NaN protection
    const safeNumber = (value: any): number => {
      const num = parseFloat(String(value || 0))
      return isNaN(num) ? 0 : num
    }
    
    const totalLoss = processes.reduce((sum, p) => sum + safeNumber(p.goldLoss), 0)
    
    if (makingChargeAmount > totalLoss) {
      return NextResponse.json(
        { error: `Making charge amount (${makingChargeAmount}g) cannot exceed total loss (${totalLoss.toFixed(3)}g)` },
        { status: 400 }
      )
    }

    // Update the karigar document with bulk making charge
    const updateResult = await db.collection('karigars').updateOne(
      { _id: new ObjectId(karigarId) },
      { 
        $set: {
          bulkMakingCharge: makingChargeAmount,
          updatedAt: new Date()
        }
      }
    )

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update karigar making charge' },
        { status: 500 }
      )
    }

    // Create a transaction record for the making charge setting
    await db.collection('transactions').insertOne({
      _id: new ObjectId(),
      type: 'KARIGAR_SALARY',
      amount: makingChargeAmount,
      description: description || `Bulk making charge set for karigar - ${makingChargeAmount}g`,
      recoveredGold: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    console.log(`Successfully set bulk making charge of ${makingChargeAmount}g for karigar ${karigarId}`)

    return NextResponse.json({
      message: `Bulk making charge of ${makingChargeAmount}g set for karigar`,
      karigarId,
      totalLoss: totalLoss,
      bulkMakingCharge: makingChargeAmount,
      actualRecoverable: totalLoss - makingChargeAmount,
      processesCount: processes.length
    })

  } catch (error) {
    console.error('Error setting bulk making charge:', error)
    return NextResponse.json(
      { error: 'Failed to set bulk making charge' },
      { status: 500 }
    )
  }
}

// GET /api/karigars/[id]/bulk-making-charge - Get bulk making charge for karigar
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await connectToDatabase()
    const resolvedParams = await params
    const karigarId = resolvedParams.id

    // Get karigar with bulk making charge
    const karigar = await db.collection('karigars').findOne({ 
      _id: new ObjectId(karigarId) 
    })

    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }

    // Get all processes for this karigar to calculate totals
    const processes = await db.collection('processes')
      .find({ karigarId: karigarId })
      .toArray()

    // Calculate totals with NaN protection
    const safeNumber = (value: any): number => {
      const num = parseFloat(String(value || 0))
      return isNaN(num) ? 0 : num
    }
    
    const totalLoss = processes.reduce((sum, p) => sum + safeNumber(p.goldLoss), 0)
    const totalRecovered = processes.reduce((sum, p) => sum + safeNumber(p.goldRecovered), 0)
    const bulkMakingCharge = safeNumber(karigar.bulkMakingCharge)
    const actualRecoverable = Math.max(0, totalLoss - bulkMakingCharge - totalRecovered)

    return NextResponse.json({
      karigarId,
      name: karigar.name,
      totalLoss,
      bulkMakingCharge,
      totalRecovered,
      actualRecoverable,
      processCount: processes.length,
      lastUpdated: karigar.updatedAt
    })

  } catch (error) {
    console.error('Error fetching bulk making charge:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bulk making charge' },
      { status: 500 }
    )
  }
}
