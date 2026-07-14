import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsersCollection, getGoldTransactionsCollection } from '@/lib/mongodb'
import { Casting, Inventory, toClientFormat, getObjectId, TransactionType } from '@/types/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'

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

    const db = await getDb()
    const castings = await db.collection('castings').find({}).sort({ createdAt: -1 }).toArray()
    
    return NextResponse.json({
      castings: castings.map(toClientFormat),
      success: true
    })
  } catch (error) {
    console.error('Error fetching castings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch castings' },
      { status: 500 }
    )
  }
}

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

    const { initialGoldTaken, extraGoldCut, castingLoss, description } = await request.json()

    // Validate input
    if (!initialGoldTaken || initialGoldTaken <= 0) {
      return NextResponse.json(
        { error: 'Initial gold taken must be greater than 0' },
        { status: 400 }
      )
    }

    if (extraGoldCut < 0) {
      return NextResponse.json(
        { error: 'Extra gold cut cannot be negative' },
        { status: 400 }
      )
    }

    if (castingLoss < 0) {
      return NextResponse.json(
        { error: 'Casting loss cannot be negative' },
        { status: 400 }
      )
    }

    const db = await getDb()

    const userId = user._id.toString()
    const organizationId = user.organizationId

    // Get current inventory for this user/organization
    const inventory = await db.collection('inventory').findOne({
      $or: [
        { userId: userId },
        { organizationId: organizationId },
        { _id: new ObjectId(userId) } // Fallback for existing data
      ]
    })
    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory not found' },
        { status: 404 }
      )
    }

    // Check if admin has enough stock
    if (inventory.adminStock < initialGoldTaken) {
      return NextResponse.json(
        { error: `Insufficient admin stock. Available: ${inventory.adminStock}g, Required: ${initialGoldTaken}g` },
        { status: 400 }
      )
    }

    // Calculate casting values
    const finalCastingWeight = initialGoldTaken - extraGoldCut
    
    if (finalCastingWeight <= 0) {
      return NextResponse.json(
        { error: 'Final casting weight must be greater than 0. Reduce extra gold cut amount.' },
        { status: 400 }
      )
    }

    const finalCastGold = finalCastingWeight // The casting output (loss is compensated by admin)

    // Calculate stock changes
    const adminStockBefore = inventory.adminStock
    const karigarStockBefore = inventory.karigarStock

    // Admin stock calculation:
    // 1. Initial deduction: adminStock - initialGoldTaken
    // 2. Add back extra gold: + extraGoldCut  
    // 3. Compensate for loss: - castingLoss
    const adminStockAfter = adminStockBefore - initialGoldTaken + extraGoldCut - castingLoss
    
    // Karigar stock gets the final cast gold
    const karigarStockAfter = karigarStockBefore + finalCastGold

    // Verify admin has enough stock for loss compensation
    if (adminStockAfter < 0) {
      return NextResponse.json(
        { error: `Insufficient admin stock to cover casting loss. Stock after casting: ${adminStockAfter}g` },
        { status: 400 }
      )
    }

    // Create casting record
    const castingRecord: Casting = {
      _id: getObjectId(),
      initialGoldTaken: Number(initialGoldTaken),
      extraGoldCut: Number(extraGoldCut),
      finalCastingWeight,
      castingLoss: Number(castingLoss),
      finalCastGold,
      adminStockBefore,
      adminStockAfter,
      karigarStockBefore,
      karigarStockAfter,
      description: description || '',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Insert casting record (without transaction for standalone MongoDB compatibility)
    const insertResult = await db.collection('castings').insertOne(castingRecord)

    if (!insertResult.acknowledged) {
      throw new Error('Failed to insert casting record')
    }

    const now = new Date()
    const transactionsCol = await getGoldTransactionsCollection()

    // Create transaction records for proper tracking
    const transactions = []

    // 1. Record gold taken from admin stock
    if (initialGoldTaken > 0) {
      const goldOutTransaction = {
        type: TransactionType.GOLD_OUT,
        amount: initialGoldTaken,
        description: `Gold taken for casting process - ${description || 'Casting operation'}`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      const txResult = await transactionsCol.insertOne(goldOutTransaction)
      transactions.push(txResult.insertedId)
    }

    // 2. Record extra gold returned to admin
    if (extraGoldCut > 0) {
      const goldReturnTransaction = {
        type: TransactionType.GOLD_IN,
        amount: extraGoldCut,
        description: `Extra gold cut and returned to admin - ${description || 'Casting process'}`,
        recoveredGold: extraGoldCut,
        createdAt: now,
        updatedAt: now
      }
      const txResult = await transactionsCol.insertOne(goldReturnTransaction)
      transactions.push(txResult.insertedId)
    }

    // 3. Record casting loss (this is what was missing!)
    if (castingLoss > 0) {
      const castingLossTransaction = {
        type: TransactionType.GOLD_LOSS,
        amount: castingLoss,
        description: `Casting loss during processing - ${description || 'Casting operation'}`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      const txResult = await transactionsCol.insertOne(castingLossTransaction)
      transactions.push(txResult.insertedId)
    }

    // 4. Record gold transfer to karigar
    if (finalCastGold > 0) {
      const karigarGoldTransaction = {
        type: TransactionType.GOLD_IN,
        amount: finalCastGold,
        description: `Cast gold transferred to karigar stock - ${description || 'Casting complete'}`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      const txResult = await transactionsCol.insertOne(karigarGoldTransaction)
      transactions.push(txResult.insertedId)
    }

    // Update inventory
    const updateResult = await db.collection('inventory').updateOne(
      { _id: inventory._id },
      {
        $set: {
          adminStock: adminStockAfter,
          karigarStock: karigarStockAfter,
          lastUpdated: new Date()
        }
      }
    )

    if (!updateResult.acknowledged) {
      // If inventory update fails, we should ideally rollback the casting record
      // But since we don't have transactions, we'll log an error
      console.error('Failed to update inventory after casting creation')
      throw new Error('Failed to update inventory')
    }

    // Get the inserted record with _id
    const insertedCasting = await db.collection('castings').findOne({ _id: insertResult.insertedId })
    
    return NextResponse.json({
      casting: toClientFormat(insertedCasting!),
      stockUpdates: {
        adminStockBefore,
        adminStockAfter,
        karigarStockBefore, 
        karigarStockAfter
      },
      success: true
    })

  } catch (error) {
    console.error('Error creating casting record:', error)
    return NextResponse.json(
      { error: 'Failed to create casting record' },
      { status: 500 }
    )
  }
}
