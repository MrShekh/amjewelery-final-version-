import { NextRequest, NextResponse } from 'next/server'
import { getKarigarsCollection, getManufacturingProcessesCollection, getInventoryCollection, getOrdersCollection, getGoldTransactionsCollection, getRecoveryHistoryCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { TransactionType } from '@/types/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { KARAT_PURITY_VALUES, getPurityDisplayName, KaratPurity } from '@/lib/gold-conversions'
import { truncateToThreeDecimals } from '@/utils/numberFormat'

interface KaratRecoveryRequest {
  recoveredAmount: number
  makingCharge: number
  description: string
  karatPurity: number // Karat purity (92 for 22k, 75.5 for 18k, 80 for 19.2k)
}

// POST /api/karigars/[id]/karat-recovery - Record gold recovery for specific karat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID' },
        { status: 400 }
      )
    }

    // Verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    const body: KaratRecoveryRequest = await request.json()
    const { recoveredAmount, makingCharge, description, karatPurity } = body
    
    console.log('🔥 Karat Recovery Request:', { recoveredAmount, makingCharge, description, karatPurity })
    
    if (!recoveredAmount || recoveredAmount <= 0) {
      return NextResponse.json(
        { error: 'Recovery amount must be greater than 0' },
        { status: 400 }
      )
    }
    
    // Validate making charge
    const makingChargeAmount = makingCharge || 0
    if (makingChargeAmount < 0) {
      return NextResponse.json(
        { error: 'Making charge cannot be negative' },
        { status: 400 }
      )
    }
    
    // Calculate actual recovery amount after deducting making charge
    const actualRecoveryAmount = Math.max(0, recoveredAmount - makingChargeAmount)
    if (actualRecoveryAmount <= 0) {
      return NextResponse.json(
        { error: 'Actual recovery amount (after making charge) must be greater than 0' },
        { status: 400 }
      )
    }
    
    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const inventoryCol = await getInventoryCollection()
    const ordersCol = await getOrdersCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const recoveryHistoryCol = await getRecoveryHistoryCollection()
    
    // Check if karigar exists
    const karigar = await karigarsCol.findOne({ _id: new ObjectId(id) })
    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }
    
    // Get all processes for this karigar
    const allProcesses = await processesCol.find(
      { karigarId: id },
      { 
        projection: { 
          _id: 1,
          orderId: 1,
          goldLoss: 1, 
          goldRecovered: 1,
          karigarMakingCharge: 1,
          adminRecoverable: 1,
          createdAt: 1
        } 
      }
    ).toArray()
    
    // Filter processes by karat purity
    const karatProcesses: any[] = []
    for (const process of allProcesses) {
      const order = await ordersCol.findOne(
        { _id: new ObjectId(process.orderId) },
        { projection: { selectedKarat: 1 } }
      )
      
      if (order) {
        const orderKaratPurity = order.selectedKarat || 92
        if (orderKaratPurity === karatPurity) {
          karatProcesses.push({
            ...process,
            orderKaratPurity
          })
        }
      }
    }
    
    console.log(`📊 Found ${karatProcesses.length} processes for ${karatPurity}% karat out of ${allProcesses.length} total processes`)
    
    if (karatProcesses.length === 0) {
      return NextResponse.json(
        { error: `No processes found for ${karatPurity}% karat purity` },
        { status: 400 }
      )
    }
    
    // Calculate total pending recovery for this karat considering making charges
    const totalLoss = karatProcesses.reduce((sum, p) => sum + (p.goldLoss || 0), 0)
    const totalMakingCharges = karatProcesses.reduce((sum, p) => sum + (p.karigarMakingCharge || 0), 0)
    const totalRecovered = karatProcesses.reduce((sum, p) => sum + (p.goldRecovered || 0), 0)
    const totalActualRecoverable = Math.max(0, totalLoss - totalMakingCharges)
    const totalPending = Math.max(0, totalActualRecoverable - totalRecovered)
    
    console.log(`📈 Karat ${karatPurity}% Stats:`, {
      totalLoss,
      totalMakingCharges,
      totalRecovered,
      totalActualRecoverable,
      totalPending
    })
    
    if (actualRecoveryAmount > totalPending) {
      return NextResponse.json(
        { error: `Actual recovery amount (${actualRecoveryAmount}g) exceeds pending loss (${totalPending.toFixed(3)}g) for ${karatPurity}% karat` },
        { status: 400 }
      )
    }
    
    if (totalPending === 0) {
      return NextResponse.json(
        { error: `No pending gold loss to recover for ${karatPurity}% karat` },
        { status: 400 }
      )
    }
    
    // Distribute the recovery proportionally across processes with pending admin recoverable loss
    const processesWithPending = karatProcesses.filter(p => {
      const adminRecoverable = p.adminRecoverable || Math.max(0, (p.goldLoss || 0) - (p.karigarMakingCharge || 0))
      const pending = adminRecoverable - (p.goldRecovered || 0)
      return pending > 0
    })
    
    if (processesWithPending.length === 0) {
      return NextResponse.json(
        { error: `No processes with pending recovery found for ${karatPurity}% karat` },
        { status: 400 }
      )
    }
    
    // Calculate recovery distribution based on admin recoverable amount
    const updates = processesWithPending.map(process => {
      const currentRecovered = process.goldRecovered || 0
      const adminRecoverable = process.adminRecoverable || Math.max(0, (process.goldLoss || 0) - (process.karigarMakingCharge || 0))
      const pendingForProcess = adminRecoverable - currentRecovered
      const recoveryRatio = pendingForProcess / totalPending
      const recoveryForProcess = actualRecoveryAmount * recoveryRatio
      
      return {
        processId: process._id,
        newRecoveredAmount: currentRecovered + recoveryForProcess,
        adminRecoverable: adminRecoverable
      }
    })
    
    // Update all processes with their proportional recovery
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: update.processId },
        update: { 
          $set: { 
            goldRecovered: Number(update.newRecoveredAmount.toFixed(6)), // Round to avoid floating point issues
            isFullyRecovered: true // ALWAYS mark as fully recovered in this recovery flow
          } 
        }
      }
    }))
    
    await processesCol.bulkWrite(bulkOps)
    
    // Convert actual recovered karat gold to fine gold for admin stock update  
    const recoveredFineGold = actualRecoveryAmount * (karatPurity / 100)
    const now = new Date()
    
    console.log(`💎 Converting ${actualRecoveryAmount}g of ${karatPurity}% karat to ${recoveredFineGold.toFixed(6)}g fine gold`)
    
    // Update inventory - add fine gold equivalent to admin stock, decrement karigarLossStock by totalLoss, increment recoveredStock by actualRecoveryAmount
    const inventory = await inventoryCol.findOne({})
    if (inventory) {
      await inventoryCol.updateOne(
        { _id: inventory._id },
        {
          $inc: {
            adminStock: recoveredFineGold, // Keep for backward compatibility
            karigarLossStock: -truncateToThreeDecimals(totalLoss), // Deduct full totalLoss
            recoveredStock: truncateToThreeDecimals(actualRecoveryAmount) // Add actual returned gold
          },
          $set: {
            lastUpdated: now
          }
        }
      )
    }

    
    // Create recovery transaction
    const recoveryTransaction = {
      type: TransactionType.GOLD_RECOVERY,
      amount: recoveredFineGold,
      description: `${karatPurity}% karat gold recovery for karigar ${karigar.name} - ${recoveredAmount.toFixed(3)}g total (${makingChargeAmount.toFixed(3)}g making charge, ${actualRecoveryAmount.toFixed(3)}g actual recovery = ${recoveredFineGold.toFixed(3)}g fine)${description ? `: ${description}` : ''}`,
      recoveredGold: recoveredFineGold,
      karatPurity: karatPurity,
      originalKaratAmount: actualRecoveryAmount,
      createdAt: now,
      updatedAt: now
    }
    const txResult = await transactionsCol.insertOne(recoveryTransaction)
    
    // Calculate remaining balance after this recovery
    const remainingBalanceAfterRecovery = Math.max(0, totalPending - actualRecoveryAmount)
    
    // Get karat label for display
    const karatDisplayName = getPurityDisplayName(karatPurity as KaratPurity)
    const karatLabel = karatDisplayName.split(' ')[0] // Extract just the "22k" part
    
    // Save recovery history record
    const recoveryHistoryRecord = {
      karigarId: id,
      karigarName: karigar.name,
      totalRecoveryAmount: Number(recoveredAmount),
      makingCharge: Number(makingChargeAmount),
      actualRecoveryAmount: Number(actualRecoveryAmount),
      remainingBalance: Number(remainingBalanceAfterRecovery.toFixed(6)),
      karatPurity: karatPurity,
      karatLabel: karatLabel,
      recoveryType: `KARAT_SPECIFIC_${karatLabel.toUpperCase()}`,
      description: description || `${karatLabel} karat gold recovery from manufacturing losses`,
      fineGoldRecovered: recoveredFineGold,
      transactionId: txResult.insertedId,
      processesAffected: updates.length,
      totalLossBeforeRecovery: totalLoss,
      totalRecoveredBeforeThis: totalRecovered,
      createdAt: now,
      updatedAt: now
    }
    
    await recoveryHistoryCol.insertOne(recoveryHistoryRecord)
    
    // Recovery session summary
    const recoverySession = {
      karigarId: id,
      karatPurity: karatPurity,
      karatLabel: karatLabel,
      totalRecoveredAmountKarat: Number(recoveredAmount),
      makingChargeAmount: Number(makingChargeAmount),
      actualRecoveredAmountKarat: Number(actualRecoveryAmount),
      recoveredAmountFineGold: recoveredFineGold,
      description: description || `${karatLabel} karat gold recovery from manufacturing losses`,
      processesAffected: updates.length,
      distributedAmounts: updates.map(u => {
        const originalProcess = karatProcesses.find(p => p._id.equals(u.processId))
        return {
          processId: u.processId.toString(),
          amount: Number((u.newRecoveredAmount - (originalProcess?.goldRecovered || 0)).toFixed(6)),
          adminRecoverable: u.adminRecoverable,
          isFullyRecovered: u.newRecoveredAmount >= u.adminRecoverable
        }
      }),
      transactionId: txResult.insertedId,
      createdAt: now
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully recorded ${karatLabel} recovery: ${recoveredAmount}g total (${makingChargeAmount}g making charge + ${actualRecoveryAmount}g actual = ${recoveredFineGold.toFixed(3)}g fine) across ${updates.length} processes`,
      recoverySession,
      newAdminStock: inventory ? inventory.adminStock + recoveredFineGold : null,
      summary: {
        karatPurity: karatPurity,
        karatLabel: karatLabel,
        totalLoss: totalLoss,
        totalMakingCharges: totalMakingCharges,
        totalActualRecoverable: totalActualRecoverable,
        totalRecoveredAmount: recoveredAmount,
        makingChargeDeducted: makingChargeAmount,
        actualRecoveredKarat: actualRecoveryAmount,
        totalRecoveredFineGold: recoveredFineGold,
        processesAffected: updates.length,
        remainingPending: Number((totalPending - actualRecoveryAmount).toFixed(6))
      }
    })
  } catch (error) {
    console.error('Error recording karat recovery:', error)
    return NextResponse.json(
      { error: 'Failed to record karat-specific gold recovery' },
      { status: 500 }
    )
  }
}
