import { NextRequest, NextResponse } from 'next/server'
import { getKarigarsCollection, getGoldTransactionsCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

interface SimpleRecoveryRequest {
  processType: string
  makingCharge: number
  actualRecovery: number
  description: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: karigarId } = await params
    
    // Validate karigarId format
    if (!ObjectId.isValid(karigarId)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID format' },
        { status: 400 }
      )
    }

    // Verify JWT token
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

    const body: SimpleRecoveryRequest = await request.json()
    const { processType, makingCharge, actualRecovery, description } = body

    // Validate inputs
    if (!processType) {
      return NextResponse.json(
        { error: 'Process type is required' },
        { status: 400 }
      )
    }

    if (makingCharge < 0) {
      return NextResponse.json(
        { error: 'Making charge cannot be negative' },
        { status: 400 }
      )
    }

    if (actualRecovery < 0) {
      return NextResponse.json(
        { error: 'Actual recovery cannot be negative' },
        { status: 400 }
      )
    }

    if (makingCharge === 0 && actualRecovery === 0) {
      return NextResponse.json(
        { error: 'Either making charge or actual recovery must be greater than 0' },
        { status: 400 }
      )
    }

    const karigarsCol = await getKarigarsCollection()
    const goldTransactionsCol = await getGoldTransactionsCollection()

    // Get karigar details and processes
    const karigar = await karigarsCol.findOne(
      { _id: new ObjectId(karigarId) },
      { 
        projection: { 
          name: 1, 
          processes: 1 
        } 
      }
    )

    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }

    // Filter processes by type and calculate current loss/recovery amounts
    const processesOfType = (karigar.processes || []).filter((p: any) => p.processType === processType)
    
    console.log(`🔍 Looking for processes of type: ${processType}`)
    console.log(`📋 Total processes for karigar: ${(karigar.processes || []).length}`)
    console.log(`🗂️ Karigar processes:`, JSON.stringify(karigar.processes, null, 2))
    console.log(`🎯 Found ${processesOfType.length} processes of type ${processType}`)
    
    let processesToUse = processesOfType

    if (processesOfType.length === 0) {
      // Fallback: allow totals-only recovery even if no processes exist
      console.log('⚠️ No processes of this type. Proceeding with totals-only recovery.')
      processesToUse = []
    }

    const totalLoss = processesToUse.reduce((sum: number, p: any) => sum + (p.goldLoss || 0), 0)
    const totalRecovered = processesToUse.reduce((sum: number, p: any) => sum + (p.goldRecovered || 0), 0)
    // If no processes, remainingLoss is treated as Infinity for validation, we will only validate non-negative inputs
    const remainingLoss = processesToUse.length > 0 ? Math.max(0, totalLoss - totalRecovered) : Number.POSITIVE_INFINITY

    // Validate that we don't exceed available loss when we have processes data
    if (processesToUse.length > 0 && (makingCharge + actualRecovery) > remainingLoss) {
      return NextResponse.json(
        { error: `Total amount (${makingCharge + actualRecovery}g) exceeds remaining loss (${remainingLoss.toFixed(3)}g)` },
        { status: 400 }
      )
    }

    const currentTimestamp = new Date()
    const recoveryId = new ObjectId()
    
    // Create transactions array
    const transactions = []
    
    // 1. Create making charge transaction (if any)
    if (makingCharge > 0) {
      transactions.push({
        _id: new ObjectId(),
        type: 'MAKING_CHARGE',
        description: `Making charge for ${processType} - ${description}`,
        goldAmount: makingCharge,
        transactionDate: currentTimestamp,
        processType: processType,
        karigarId: new ObjectId(karigarId),
        karigarName: karigar.name,
        recoveryId: recoveryId,
        createdAt: currentTimestamp
      })
    }

    // 2. Create actual recovery transaction (if any)
    if (actualRecovery > 0) {
      transactions.push({
        _id: new ObjectId(),
        type: 'GOLD_RECOVERY',
        description: `Gold recovery for ${processType} - ${description}`,
        goldAmount: actualRecovery,
        transactionDate: currentTimestamp,
        processType: processType,
        karigarId: new ObjectId(karigarId),
        karigarName: karigar.name,
        recoveryId: recoveryId,
        createdAt: currentTimestamp
      })
    }

    // Insert all transactions
    if (transactions.length > 0) {
      await goldTransactionsCol.insertMany(transactions)
    }

    // Update process recovery amounts in karigar collection
    const totalRecoveryAmount = makingCharge + actualRecovery
    
    if (totalRecoveryAmount > 0 && processesToUse.length > 0) {
      // Distribute recovery across processes proportionally
      const updatePromises = processesToUse.map(async (process: any) => {
        const processLoss = process.goldLoss || 0
        const processRecovered = process.goldRecovered || 0
        const processRemainingLoss = Math.max(0, processLoss - processRecovered)
        
        if (processRemainingLoss > 0) {
          // Calculate proportional recovery for this process
          const proportionalRecovery = (processRemainingLoss / remainingLoss) * totalRecoveryAmount
          const newRecovered = processRecovered + proportionalRecovery
          
          return karigarsCol.updateOne(
            { 
              _id: new ObjectId(karigarId), 
              'processes.id': process.id 
            },
            { 
              $set: { 
                'processes.$.goldRecovered': newRecovered,
                'processes.$.lastRecoveryDate': currentTimestamp
              } 
            }
          )
        }
      })
      
      await Promise.all(updatePromises)
    }

    // Calculate remaining amounts after this recovery
    const newRemainingLoss = processesToUse.length > 0 ? (remainingLoss - totalRecoveryAmount) : Math.max(0, 0)

    return NextResponse.json({
      success: true,
      message: 'Recovery recorded successfully',
      recovery: {
        recoveryId: recoveryId,
        processType,
        makingCharge,
        actualRecovery,
        totalAmount: totalRecoveryAmount,
        description,
        date: currentTimestamp,
        remainingLoss: newRemainingLoss,
        processCount: processesToUse.length
      },
      transactions: transactions.map(t => ({
        id: t._id,
        type: t.type,
        amount: t.goldAmount,
        description: t.description
      }))
    })

  } catch (error) {
    console.error('Error recording simple recovery:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
