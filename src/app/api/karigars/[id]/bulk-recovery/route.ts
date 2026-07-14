import { NextRequest, NextResponse } from 'next/server'
import { getManufacturingProcessesCollection, getGoldTransactionsCollection, getInventoryCollection, getOrdersCollection } from '@/lib/mongodb'
import { ProcessType, TransactionType, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'

// POST /api/karigars/[id]/bulk-recovery - Record bulk loss recovery for a karigar by process type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: karigarId } = await params
    
    if (!ObjectId.isValid(karigarId)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const { processType, recoveredAmount, recoveryPeriod, description } = body
    
    if (!processType || !recoveredAmount || !recoveryPeriod) {
      return NextResponse.json(
        { error: 'Process type, recovered amount, and recovery period are required' },
        { status: 400 }
      )
    }

    if (!Object.values(ProcessType).includes(processType)) {
      return NextResponse.json(
        { error: 'Invalid process type' },
        { status: 400 }
      )
    }

    const recoveryAmount = parseFloat(recoveredAmount)
    if (recoveryAmount <= 0) {
      return NextResponse.json(
        { error: 'Recovery amount must be greater than 0' },
        { status: 400 }
      )
    }

    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const inventoryCol = await getInventoryCollection()
    const ordersCol = await getOrdersCollection()
    
    // Find all unrecovered losses for this karigar and process type
    const processes = await processesCol.find({
      karigarId,
      processType,
      goldLoss: { $gt: 0 }
    }).sort({ createdAt: 1 }).toArray()

    if (processes.length === 0) {
      return NextResponse.json(
        { error: `No ${processType} processes with losses found for this karigar` },
        { status: 404 }
      )
    }

    // Get karat information for conversion - use first process to determine karat
    // (all processes for same karigar should be same karat)
    let karatPurity = 0.92 // Default to 92%
    if (processes.length > 0) {
      const firstOrder = await ordersCol.findOne({ _id: new ObjectId(processes[0].orderId) })
      if (firstOrder) {
        const selectedKarat = firstOrder.selectedKarat || 92
        karatPurity = selectedKarat / 100
      }
    }
    
    // Calculate total unrecovered loss with NaN protection
    const safeNumber = (value: any): number => {
      const num = parseFloat(String(value || 0))
      return isNaN(num) ? 0 : num
    }
    
    let totalUnrecoveredLoss = 0
    let processesToUpdate: any[] = []
    let remainingRecovery = recoveryAmount

    for (const process of processes) {
      const currentRecovered = safeNumber(process.goldRecovered)
      const unrecoveredLoss = Math.max(0, safeNumber(process.goldLoss) - currentRecovered)
      
      if (unrecoveredLoss > 0 && remainingRecovery > 0) {
        const recoveryForThisProcess = Math.min(unrecoveredLoss, remainingRecovery)
        const newTotalRecovered = currentRecovered + recoveryForThisProcess
        
        processesToUpdate.push({
          processId: process._id,
          orderId: process.orderId,
          currentRecovered,
          newTotalRecovered,
          recoveryAdded: recoveryForThisProcess,
          originalLoss: safeNumber(process.goldLoss)
        })
        
        totalUnrecoveredLoss += unrecoveredLoss
        remainingRecovery -= recoveryForThisProcess
      }
    }

    if (recoveryAmount > totalUnrecoveredLoss) {
      return NextResponse.json(
        { error: `Recovery amount (${recoveryAmount}g) exceeds total unrecovered loss (${totalUnrecoveredLoss.toFixed(3)}g) for ${processType}` },
        { status: 400 }
      )
    }

    const now = new Date()

    // Convert total recovery from karat to fine gold for stock update
    const recoveredFineGold = recoveryAmount * karatPurity
    
    // Update all affected processes
    for (const update of processesToUpdate) {
      await processesCol.updateOne(
        { _id: update.processId },
        {
          $set: {
            goldRecovered: update.newTotalRecovered,
            updatedAt: now
          }
        }
      )
    }
    
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

    // Create a bulk recovery transaction (record in fine gold terms)
    const transactionDoc = {
      type: TransactionType.GOLD_RECOVERY,
      amount: recoveredFineGold,
      description: `Bulk ${processType} loss recovery for karigar - ${recoveryAmount.toFixed(3)}g karat (${recoveredFineGold.toFixed(3)}g fine) - ${recoveryPeriod}${description ? `: ${description}` : ''}`,
      recoveredGold: recoveredFineGold,
      createdAt: now,
      updatedAt: now
    }
    
    const transactionResult = await transactionsCol.insertOne(transactionDoc)
    const transaction = await transactionsCol.findOne({ _id: transactionResult.insertedId })

    // Calculate summary
    const affectedProcessIds = processesToUpdate.map(p => p.processId.toString())
    const totalLossAffected = processesToUpdate.reduce((sum, p) => sum + p.originalLoss, 0)
    const remainingLossAfterRecovery = totalUnrecoveredLoss - recoveryAmount

    return NextResponse.json({
      message: `Successfully recorded bulk recovery of ${recoveryAmount}g karat (${recoveredFineGold.toFixed(3)}g fine) for ${processType} processes`,
      recovery: {
        processType,
        recoveredAmountKarat: recoveryAmount,
        recoveredAmountFineGold: recoveredFineGold,
        karatPurity: karatPurity * 100,
        recoveryPeriod,
        affectedProcesses: processesToUpdate.length,
        affectedProcessIds,
        totalLossBeforeRecovery: totalLossAffected,
        remainingLoss: remainingLossAfterRecovery,
        recoveryDate: now
      },
      transaction: toClientFormat(transaction!),
      newAdminStock: inventory ? inventory.adminStock + recoveredFineGold : null,
      updatedProcesses: processesToUpdate.map(p => ({
        processId: p.processId.toString(),
        orderId: p.orderId,
        previousRecovered: p.currentRecovered,
        newTotalRecovered: p.newTotalRecovered,
        recoveryAdded: p.recoveryAdded
      }))
    })
  } catch (error) {
    console.error('Error recording bulk recovery:', error)
    return NextResponse.json(
      { error: 'Failed to record bulk recovery' },
      { status: 500 }
    )
  }
}

// GET /api/karigars/[id]/bulk-recovery - Get bulk recovery summary for a karigar
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: karigarId } = await params
    
    if (!ObjectId.isValid(karigarId)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID' },
        { status: 400 }
      )
    }

    const processesCol = await getManufacturingProcessesCollection()
    
    // Get all processes for this karigar grouped by process type
    const processes = await processesCol.find({ karigarId }).toArray()
    
    // Group by process type and calculate summaries
    const summary = {
      [ProcessType.FILING]: { totalLoss: 0, totalRecovered: 0, pendingRecovery: 0, processCount: 0 },
      [ProcessType.FREE_POLISH]: { totalLoss: 0, totalRecovered: 0, pendingRecovery: 0, processCount: 0 },
      [ProcessType.STONE_SETTING]: { totalLoss: 0, totalRecovered: 0, pendingRecovery: 0, processCount: 0 },
      [ProcessType.FINAL_POLISH]: { totalLoss: 0, totalRecovered: 0, pendingRecovery: 0, processCount: 0 }
    }

    // Helper function for safe number conversion
    const safeNumber = (value: any): number => {
      const num = parseFloat(String(value || 0))
      return isNaN(num) ? 0 : num
    }
    
    processes.forEach(process => {
      if (process.processType in summary) {
        const processTypeKey = process.processType as ProcessType
        const recovered = safeNumber(process.goldRecovered)
        const loss = safeNumber(process.goldLoss)
        
        summary[processTypeKey].totalLoss += loss
        summary[processTypeKey].totalRecovered += recovered
        summary[processTypeKey].pendingRecovery += Math.max(0, loss - recovered)
        summary[processTypeKey].processCount += 1
      }
    })

    // Get recovery schedule info
    const now = new Date()
    const currentWeek = getWeekNumber(now)
    const currentMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' })
    
    return NextResponse.json({
      karigarId,
      summary,
      scheduleInfo: {
        currentWeek: `Week ${currentWeek} ${now.getFullYear()}`,
        currentMonth,
        filingStoneSettingRecoveryDue: 'Weekly',
        polishRecoveryDue: 'Monthly'
      },
      lastUpdated: now
    })
  } catch (error) {
    console.error('Error getting bulk recovery summary:', error)
    return NextResponse.json(
      { error: 'Failed to get bulk recovery summary' },
      { status: 500 }
    )
  }
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
