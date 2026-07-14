import { NextRequest, NextResponse } from 'next/server'
import { getKarigarsCollection, getManufacturingProcessesCollection, getInventoryCollection, getOrdersCollection, getGoldTransactionsCollection, getRecoveryHistoryCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { TransactionType } from '@/types/mongodb'

// POST /api/karigars/[id]/total-recovery - Record total gold recovery for karigar
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
    
    const body = await request.json()
    const { recoveredAmount, makingCharge, description } = body
    
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
    const processes = await processesCol.find(
      { karigarId: id },
      { 
        projection: { 
          _id: 1,
          orderId: 1,
          goldLoss: 1, 
          goldRecovered: 1,
          karigarMakingCharge: 1,
          adminRecoverable: 1
        } 
      }
    ).toArray()
    
    // Calculate total pending recovery considering making charges
    const totalLoss = processes.reduce((sum, p) => sum + (p.goldLoss || 0), 0)
    const totalMakingCharges = processes.reduce((sum, p) => sum + (p.karigarMakingCharge || 0), 0)
    const totalRecovered = processes.reduce((sum, p) => sum + (p.goldRecovered || 0), 0)
    const totalActualRecoverable = Math.max(0, totalLoss - totalMakingCharges)
    const totalPending = Math.max(0, totalActualRecoverable - totalRecovered)
    
    if (actualRecoveryAmount > totalPending) {
      return NextResponse.json(
        { error: `Actual recovery amount (${actualRecoveryAmount}g) exceeds pending loss (${totalPending.toFixed(3)}g)` },
        { status: 400 }
      )
    }
    
    if (totalPending === 0) {
      return NextResponse.json(
        { error: 'No pending gold loss to recover for this karigar' },
        { status: 400 }
      )
    }
    
    // Get karat information for conversion - use first process to determine karat
    let karatPurity = 0.92 // Default to 92%
    if (processes.length > 0) {
      const firstOrder = await ordersCol.findOne({ _id: new ObjectId(processes[0].orderId) })
      if (firstOrder) {
        const selectedKarat = firstOrder.selectedKarat || 92
        karatPurity = selectedKarat / 100
      }
    }
    
    // Distribute the recovery proportionally across processes with pending admin recoverable loss
    const processesWithPending = processes.filter(p => {
      const adminRecoverable = p.adminRecoverable || Math.max(0, (p.goldLoss || 0) - (p.karigarMakingCharge || 0))
      const pending = adminRecoverable - (p.goldRecovered || 0)
      return pending > 0
    })
    
    if (processesWithPending.length === 0) {
      return NextResponse.json(
        { error: 'No processes with pending recovery found' },
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
            isFullyRecovered: update.newRecoveredAmount >= update.adminRecoverable || Math.abs(update.newRecoveredAmount - update.adminRecoverable) <= 0.005
          } 
        }
      }
    }))
    
    await processesCol.bulkWrite(bulkOps)
    
    // Convert actual recovered karat gold to fine gold for admin stock update  
    const recoveredFineGold = actualRecoveryAmount * karatPurity
    const now = new Date()
    
    // Update inventory - add fine gold equivalent to admin stock
    const inventory = await inventoryCol.findOne({})
    if (inventory) {
      await inventoryCol.updateOne(
        { _id: inventory._id },
        {
          $inc: {
            adminStock: recoveredFineGold // Add fine gold equivalent
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
      description: `Total gold recovery for karigar ${karigar.name} - ${recoveredAmount.toFixed(3)}g total (${makingChargeAmount.toFixed(3)}g making charge, ${actualRecoveryAmount.toFixed(3)}g actual recovery = ${recoveredFineGold.toFixed(3)}g fine)${description ? `: ${description}` : ''}`,
      recoveredGold: recoveredFineGold,
      createdAt: now,
      updatedAt: now
    }
    const txResult = await transactionsCol.insertOne(recoveryTransaction)
    
    // Calculate remaining balance after this recovery
    const remainingBalanceAfterRecovery = Math.max(0, totalPending - actualRecoveryAmount)
    
    // Determine process types involved in this recovery
    const processTypesInvolved = [...new Set(processesWithPending.map(p => {
      const originalProcess = processes.find(orig => orig._id.equals(p.processId))
      return originalProcess ? (async () => {
        const order = await ordersCol.findOne({ _id: new ObjectId(originalProcess.orderId) })
        return order ? order.processType || 'UNKNOWN' : 'UNKNOWN'
      })() : 'UNKNOWN'
    }))]
    
    // Get actual process types
    const processTypePromises = processesWithPending.map(async p => {
      const originalProcess = processes.find(orig => orig._id.equals(p.processId))
      if (originalProcess) {
        const processDetails = await processesCol.findOne({ _id: originalProcess._id }, { projection: { processType: 1 } })
        return processDetails ? processDetails.processType : 'UNKNOWN'
      }
      return 'UNKNOWN'
    })
    
    const processTypes = await Promise.all(processTypePromises)
    const uniqueProcessTypes = [...new Set(processTypes)]
    
    // Determine recovery type based on process types
    let recoveryType = 'MANUAL'
    if (uniqueProcessTypes.some(type => type === 'FILING' || type === 'STONE_SETTING')) {
      recoveryType = 'WEEKLY_FILING'
    } else if (uniqueProcessTypes.some(type => type === 'FINAL_POLISH')) {
      recoveryType = 'MONTHLY_POLISH'
    }
    
    // Save recovery history record
    const recoveryHistoryRecord = {
      karigarId: id,
      karigarName: karigar.name,
      totalRecoveryAmount: Number(recoveredAmount),
      makingCharge: Number(makingChargeAmount),
      actualRecoveryAmount: Number(actualRecoveryAmount),
      remainingBalance: Number(remainingBalanceAfterRecovery.toFixed(6)),
      processTypes: uniqueProcessTypes,
      recoveryType: recoveryType,
      description: description || 'Total gold recovery from manufacturing losses',
      karatPurity: karatPurity * 100,
      fineGoldRecovered: recoveredFineGold,
      transactionId: txResult.insertedId,
      processesAffected: updates.length,
      totalLossBeforeRecovery: totalLoss,
      totalRecoveredBeforeThis: totalRecovered,
      createdAt: now,
      updatedAt: now
    }
    
    await recoveryHistoryCol.insertOne(recoveryHistoryRecord)
    
    // Log recovery session (optional - you might want to create a recovery log collection)
    const recoverySession = {
      karigarId: id,
      totalRecoveredAmountKarat: Number(recoveredAmount),
      makingChargeAmount: Number(makingChargeAmount),
      actualRecoveredAmountKarat: Number(actualRecoveryAmount),
      recoveredAmountFineGold: recoveredFineGold,
      karatPurity: karatPurity * 100,
      description: description || 'Total gold recovery from manufacturing losses',
      processesAffected: updates.length,
      distributedAmounts: updates.map(u => {
        const originalProcess = processes.find(p => p._id.equals(u.processId))
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
    
    // You might want to store this in a separate recovery log collection
    // For now, we'll just return the session info
    
    return NextResponse.json({
      success: true,
      message: `Successfully recorded recovery: ${recoveredAmount}g total (${makingChargeAmount}g making charge + ${actualRecoveryAmount}g actual = ${recoveredFineGold.toFixed(3)}g fine) across ${updates.length} processes`,
      recoverySession,
      newAdminStock: inventory ? inventory.adminStock + recoveredFineGold : null,
      summary: {
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
    console.error('Error recording total recovery:', error)
    return NextResponse.json(
      { error: 'Failed to record gold recovery' },
      { status: 500 }
    )
  }
}

// GET /api/karigars/[id]/total-recovery - Get total recovery summary for karigar
export async function GET(
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
    
    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    
    // Check if karigar exists
    const karigar = await karigarsCol.findOne({ _id: new ObjectId(id) })
    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }
    
    // Get all processes for this karigar
    const processes = await processesCol.find(
      { karigarId: id },
      { 
        projection: { 
          _id: 1,
          processType: 1,
          goldLoss: 1, 
          goldRecovered: 1,
          createdAt: 1
        } 
      }
    ).toArray()
    
    // Calculate totals
    const totalLoss = processes.reduce((sum, p) => sum + (p.goldLoss || 0), 0)
    const totalRecovered = processes.reduce((sum, p) => sum + (p.goldRecovered || 0), 0)
    const totalPending = Math.max(0, totalLoss - totalRecovered)
    
    // Calculate by process type
    const byProcessType = processes.reduce((acc, process) => {
      const type = process.processType || 'UNKNOWN'
      if (!acc[type]) {
        acc[type] = {
          totalLoss: 0,
          totalRecovered: 0,
          processCount: 0
        }
      }
      
      acc[type].totalLoss += process.goldLoss || 0
      acc[type].totalRecovered += process.goldRecovered || 0
      acc[type].processCount += 1
      
      return acc
    }, {} as Record<string, { totalLoss: number, totalRecovered: number, processCount: number, pendingRecovery?: number }>)
    
    // Add pending recovery for each process type
    Object.keys(byProcessType).forEach(type => {
      byProcessType[type].pendingRecovery = Math.max(0, 
        byProcessType[type].totalLoss - byProcessType[type].totalRecovered
      )
    })
    
    return NextResponse.json({
      summary: {
        totalProcesses: processes.length,
        totalLoss: Number(totalLoss.toFixed(6)),
        totalRecovered: Number(totalRecovered.toFixed(6)),
        totalPending: Number(totalPending.toFixed(6)),
        recoveryPercentage: totalLoss > 0 ? Number(((totalRecovered / totalLoss) * 100).toFixed(2)) : 0
      },
      byProcessType,
      karigarName: karigar.name
    })
  } catch (error) {
    console.error('Error fetching recovery summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recovery summary' },
      { status: 500 }
    )
  }
}
