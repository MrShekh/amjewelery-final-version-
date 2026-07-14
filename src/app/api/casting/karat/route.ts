import { NextRequest, NextResponse } from 'next/server'
import { getDb, getUsersCollection, getGoldTransactionsCollection } from '@/lib/mongodb'
import { toClientFormat, getObjectId, TransactionType } from '@/types/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'
import { KaratPurity, karatToFine } from '@/lib/gold-conversions'

interface KaratCastingRecord {
  _id?: ObjectId
  fineGoldTaken: number
  selectedPurity: KaratPurity
  maxKaratGoldPossible: number
  actualKaratGoldCast: number
  remainingKaratGold: number
  fineGoldReturnedToAdmin: number
  adminStockBefore: number
  adminStockAfter: number
  description?: string
  createdAt: Date
  updatedAt: Date
}

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
    const karatCastings = await db.collection('karat_castings').find({}).sort({ createdAt: -1 }).toArray()
    
    return NextResponse.json({
      karatCastings: karatCastings.map(toClientFormat),
      success: true
    })
  } catch (error) {
    console.error('Error fetching karat castings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch karat castings' },
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

    const { 
      fineGoldTaken, 
      selectedPurity, 
      actualKaratGoldCast, 
      fineGoldReturnedToAdmin, 
      description 
    } = await request.json()
    
    // Debug logging to help troubleshoot issues
    console.log('Casting API Request Data:', {
      fineGoldTaken,
      selectedPurity,
      actualKaratGoldCast,
      fineGoldReturnedToAdmin,
      description,
      types: {
        fineGoldTaken: typeof fineGoldTaken,
        selectedPurity: typeof selectedPurity,
        actualKaratGoldCast: typeof actualKaratGoldCast,
        fineGoldReturnedToAdmin: typeof fineGoldReturnedToAdmin
      }
    })

    // Validate input
    if (!fineGoldTaken || fineGoldTaken <= 0) {
      return NextResponse.json(
        { error: 'Fine gold taken must be greater than 0' },
        { status: 400 }
      )
    }

    if (!selectedPurity) {
      return NextResponse.json(
        { error: 'Purity selection is required' },
        { status: 400 }
      )
    }

    if (actualKaratGoldCast == null || actualKaratGoldCast < 0) {
      return NextResponse.json(
        { error: 'Actual karat gold cast must be 0 or greater' },
        { status: 400 }
      )
    }

    if (fineGoldReturnedToAdmin == null || fineGoldReturnedToAdmin < 0) {
      return NextResponse.json(
        { error: 'Fine gold returned to admin must be 0 or greater' },
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
    if (inventory.adminStock < fineGoldTaken) {
      return NextResponse.json(
        { error: `Insufficient admin stock. Available: ${inventory.adminStock}g, Required: ${fineGoldTaken}g` },
        { status: 400 }
      )
    }

    // Recalculate values to ensure consistency
    const purityFactor = parseFloat(selectedPurity) / 100
    const maxKaratGoldPossible = fineGoldTaken / purityFactor
    const remainingKaratGold = maxKaratGoldPossible - actualKaratGoldCast

    // Verify calculations are consistent
    if (actualKaratGoldCast > maxKaratGoldPossible) {
      return NextResponse.json(
        { error: 'Actual casting amount cannot exceed maximum possible karat gold' },
        { status: 400 }
      )
    }

    // Calculate fine gold equivalent of remaining karat gold
    const calculatedFineGoldReturned = karatToFine(remainingKaratGold, selectedPurity)
    
    // Allow small tolerance for floating point precision
    if (Math.abs(calculatedFineGoldReturned - fineGoldReturnedToAdmin) > 0.01) {
      console.log('Calculation mismatch details:', {
        calculatedFineGoldReturned,
        fineGoldReturnedToAdmin,
        difference: Math.abs(calculatedFineGoldReturned - fineGoldReturnedToAdmin),
        remainingKaratGold,
        selectedPurity,
        maxKaratGoldPossible,
        actualKaratGoldCast
      })
      return NextResponse.json(
        { error: `Fine gold returned calculation mismatch. Expected: ${calculatedFineGoldReturned.toFixed(3)}g, Received: ${fineGoldReturnedToAdmin.toFixed(3)}g` },
        { status: 400 }
      )
    }

    // Calculate stock changes
    const adminStockBefore = inventory.adminStock
    const adminStockAfter = adminStockBefore - fineGoldTaken + fineGoldReturnedToAdmin

    // Verify admin stock won't go negative
    if (adminStockAfter < 0) {
      return NextResponse.json(
        { error: `Insufficient admin stock. Stock after casting: ${adminStockAfter}g` },
        { status: 400 }
      )
    }

    // Create karat casting record
    const karatCastingRecord: KaratCastingRecord = {
      _id: getObjectId(),
      fineGoldTaken: Number(fineGoldTaken),
      selectedPurity,
      maxKaratGoldPossible,
      actualKaratGoldCast: Number(actualKaratGoldCast),
      remainingKaratGold,
      fineGoldReturnedToAdmin: Number(fineGoldReturnedToAdmin),
      adminStockBefore,
      adminStockAfter,
      description: description || '',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Insert casting record
    const insertResult = await db.collection('karat_castings').insertOne(karatCastingRecord)

    if (!insertResult.acknowledged) {
      throw new Error('Failed to insert karat casting record')
    }

    const now = new Date()
    const transactionsCol = await getGoldTransactionsCollection()

    // Create transaction records for proper tracking
    const transactions = []

    // 1. Record fine gold taken from admin stock
    if (fineGoldTaken > 0) {
      const goldOutTransaction = {
        type: TransactionType.GOLD_OUT,
        amount: fineGoldTaken,
        description: `Fine gold taken for ${selectedPurity}% karat casting - ${description || 'Karat casting operation'}`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      const txResult = await transactionsCol.insertOne(goldOutTransaction)
      transactions.push(txResult.insertedId)
    }

    // 2. Record fine gold returned to admin from remaining karat gold
    if (fineGoldReturnedToAdmin > 0) {
      const goldReturnTransaction = {
        type: TransactionType.GOLD_IN,
        amount: fineGoldReturnedToAdmin,
        description: `Fine gold returned from unused ${selectedPurity}% karat gold - ${description || 'Karat casting process'}`,
        recoveredGold: fineGoldReturnedToAdmin,
        createdAt: now,
        updatedAt: now
      }
      const txResult = await transactionsCol.insertOne(goldReturnTransaction)
      transactions.push(txResult.insertedId)
    }

    // 3. Record karat gold added to Karigar stock
    if (actualKaratGoldCast > 0) {
      const karigarKaratGoldTransaction = {
        type: TransactionType.GOLD_IN,
        amount: actualKaratGoldCast,
        description: `${selectedPurity}% karat gold cast and transferred to karigar stock - ${description || 'Karat casting complete'}`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      const txResult = await transactionsCol.insertOne(karigarKaratGoldTransaction)
      transactions.push(txResult.insertedId)
    }

    // Update inventory - both admin stock and karigar karat stock
    // Handle the field name for 75.5% purity (replace decimal with 755)
    const karatStockFieldSuffix = selectedPurity.toString().replace('.', '')
    const karatStockField = `karigar${karatStockFieldSuffix}Stock`
    const currentKaratStock = inventory[karatStockField] || 0
    const newKaratStock = currentKaratStock + actualKaratGoldCast

    // Also update the total karigar fine stock by calculating fine equivalent from all karat stocks
    const karigar92Stock = inventory.karigar92Stock || 0
    const karigar755Stock = inventory.karigar755Stock || 0
    const karigar80Stock = inventory.karigar80Stock || 0
    const karigar375Stock = inventory.karigar375Stock || 0

    let newKarigar92Stock = karigar92Stock
    let newKarigar755Stock = karigar755Stock
    let newKarigar80Stock = karigar80Stock
    let newKarigar375Stock = karigar375Stock

    // Update the specific karat stock
    if (selectedPurity === 92) {
      newKarigar92Stock = karigar92Stock + actualKaratGoldCast
    } else if (selectedPurity === 75.5) {
      newKarigar755Stock = karigar755Stock + actualKaratGoldCast
    } else if (selectedPurity === 80) {
      newKarigar80Stock = karigar80Stock + actualKaratGoldCast
    } else if (selectedPurity === 37.5) {
      newKarigar375Stock = karigar375Stock + actualKaratGoldCast
    }

    // Calculate total fine gold equivalent from all karat stocks
    const totalFineFromKarat = 
      karatToFine(newKarigar92Stock, 92) + 
      karatToFine(newKarigar755Stock, 75.5) + 
      karatToFine(newKarigar80Stock, 80) +
      karatToFine(newKarigar375Stock, 37.5)

    const updateData: any = {
      adminStock: adminStockAfter,
      karigarStock: totalFineFromKarat, // Update fine stock equivalent
      lastUpdated: new Date()
    }

    // Update specific karat stock
    updateData[karatStockField] = newKaratStock

    // Also explicitly update all karat stocks to ensure consistency
    updateData.karigar92Stock = newKarigar92Stock
    updateData.karigar755Stock = newKarigar755Stock
    updateData.karigar80Stock = newKarigar80Stock
    updateData.karigar375Stock = newKarigar375Stock

    const updateResult = await db.collection('inventory').updateOne(
      { _id: inventory._id },
      { $set: updateData }
    )

    if (!updateResult.acknowledged) {
      console.error('Failed to update inventory after karat casting creation')
      throw new Error('Failed to update inventory')
    }

    // Get the inserted record with _id
    const insertedKaratCasting = await db.collection('karat_castings').findOne({ _id: insertResult.insertedId })
    
    return NextResponse.json({
      karatCasting: toClientFormat(insertedKaratCasting!),
      stockUpdates: {
        adminStockBefore,
        adminStockAfter,
        karatStockUpdated: {
          purity: selectedPurity,
          before: currentKaratStock,
          after: newKaratStock
        },
        totalKarigarFineStock: totalFineFromKarat
      },
      transactionIds: transactions,
      success: true
    })

  } catch (error) {
    console.error('Error creating karat casting record:', error)
    return NextResponse.json(
      { error: 'Failed to create karat casting record' },
      { status: 500 }
    )
  }
}
