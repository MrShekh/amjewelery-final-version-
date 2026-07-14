import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getKarigarsCollection, getManufacturingProcessesCollection, getOrdersCollection, getInventoryCollection, getGoldTransactionsCollection, getRecoveryHistoryCollection } from '@/lib/mongodb'
import { TransactionType } from '@/types/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { truncateToThreeDecimals } from '@/utils/numberFormat'

interface EnhancedRecoveryRequest {
  makingCharge: number
  recoveryAmount: number
  description: string
  filteredOrders: string[] // actually process IDs from client
  karatFilter?: 'all' | '22k' | '20k' | '19.2k' | '18k' | '14.2k' | '14k' | '9k'
  recoveryStatusFilter?: 'all' | 'fully_recovered' | 'partially_recovered' | 'pending'
  selectedDate?: string // single date filter
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid karigar ID' }, { status: 400 })
    }

    // Auth
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    try { verifyToken(token) } catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

    const body: EnhancedRecoveryRequest = await request.json()
    const { makingCharge = 0, recoveryAmount = 0, description = '', filteredOrders = [], karatFilter, selectedDate } = body

    if (makingCharge < 0) return NextResponse.json({ error: 'Making charge cannot be negative' }, { status: 400 })
    if (recoveryAmount < 0) return NextResponse.json({ error: 'Recovery amount cannot be negative' }, { status: 400 })
    if ((makingCharge + recoveryAmount) <= 0) return NextResponse.json({ error: 'Nothing to record. Provide making charge and/or recovery amount.' }, { status: 400 })

    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const ordersCol = await getOrdersCollection()
    const inventoryCol = await getInventoryCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const recoveryHistoryCol = await getRecoveryHistoryCollection()

    const karigar = await karigarsCol.findOne({ _id: new ObjectId(id) })
    if (!karigar) return NextResponse.json({ error: 'Karigar not found' }, { status: 404 })

    // Fetch selected processes
    const processIds = (filteredOrders || []).filter(Boolean).map(pid => new ObjectId(pid))
    if (processIds.length === 0) return NextResponse.json({ error: 'No processes selected for recovery' }, { status: 400 })

    const processes = await processesCol.find(
      { _id: { $in: processIds }, karigarId: id },
      { projection: { _id: 1, orderId: 1, goldLoss: 1, goldRecovered: 1, karigarMakingCharge: 1 } }
    ).toArray()

    if (processes.length === 0) return NextResponse.json({ error: 'No matching processes found for this karigar' }, { status: 404 })

    // Attach karat info per process
    const orderIdSet = Array.from(new Set(processes.map(p => p.orderId).filter(Boolean)))
    const orders = await ordersCol.find(
      { _id: { $in: orderIdSet.map((oid: string) => new ObjectId(oid)) } },
      { projection: { _id: 1, selectedKarat: 1 } }
    ).toArray()

    const orderKaratMap = new Map<string, number>()
    for (const o of orders) orderKaratMap.set(o._id.toString(), Number(o.selectedKarat || 92))

    // Optionally filter by karat
    const processesWithKarat = processes.map((p: any) => ({
      ...p,
      karatPurity: orderKaratMap.get(p.orderId) || 92,
    })).filter((p: any) => {
      if (!karatFilter || karatFilter === 'all') return true
      if (karatFilter === '22k') return p.karatPurity === 92
      if (karatFilter === '20k') return p.karatPurity === 84
      if (karatFilter === '19.2k') return p.karatPurity === 80
      if (karatFilter === '18k') return p.karatPurity === 75.5
      if (karatFilter === '14.2k' || karatFilter === '14k') return p.karatPurity === 59
      if (karatFilter === '9k') return p.karatPurity === 37.5
      return true
    })

    if (processesWithKarat.length === 0) return NextResponse.json({ error: 'No processes match the karat filter' }, { status: 400 })

    // Compute pending per process
    const perProcess = processesWithKarat.map((p: any) => {
      const goldLoss = Number(p.goldLoss || 0)
      const karigarMC = Number(p.karigarMakingCharge || 0)
      const recovered = Number(p.goldRecovered || 0)
      const adminRecoverable = Math.max(0, goldLoss - karigarMC)
      const pending = Math.max(0, adminRecoverable - recovered)
      return { id: p._id, orderId: p.orderId, karatPurity: p.karatPurity, goldLoss, karigarMC, recovered, adminRecoverable, pending }
    })

    const totalPendingBefore = perProcess.reduce((s, x) => s + x.pending, 0)
    if (totalPendingBefore <= 0) return NextResponse.json({ error: 'No pending loss to recover in selected processes' }, { status: 400 })

    // Distribute making charge over pending
    let remainingMaking = makingCharge
    const mcUpdates = perProcess.map(p => {
      const ratio = p.pending > 0 ? (p.pending / totalPendingBefore) : 0
      const apply = Number((remainingMaking * ratio).toFixed(6))
      return { id: p.id, addMakingCharge: apply }
    })

    // Apply MC to recompute pending
    const perProcessAfterMC = perProcess.map(p => {
      const addMC = mcUpdates.find(u => u.id.equals(p.id))?.addMakingCharge || 0
      const newKarigarMC = p.karigarMC + addMC
      const newAdminRecoverable = Math.max(0, p.goldLoss - newKarigarMC)
      const newPending = Math.max(0, newAdminRecoverable - p.recovered)
      return { ...p, addMC, newKarigarMC, newAdminRecoverable, newPending }
    })

    const totalPendingAfterMC = perProcessAfterMC.reduce((s, x) => s + x.newPending, 0)

    if (recoveryAmount > 0 && totalPendingAfterMC <= 0) {
      return NextResponse.json({ error: 'No pending left after making charge to recover' }, { status: 400 })
    }

    // Distribute recovery amount across new pending
    const raUpdates = perProcessAfterMC.map(p => {
      if (recoveryAmount <= 0 || totalPendingAfterMC <= 0) return { id: p.id, addRecovered: 0 }
      const ratio = p.newPending > 0 ? (p.newPending / totalPendingAfterMC) : 0
      const add = Number((recoveryAmount * ratio).toFixed(6))
      return { id: p.id, addRecovered: Math.min(add, p.newPending) }
    })

    // Build bulk updates
    const bulkOps = perProcessAfterMC.map(p => {
      const addMC = mcUpdates.find(u => u.id.equals(p.id))?.addMakingCharge || 0
      const addRec = raUpdates.find(u => u.id.equals(p.id))?.addRecovered || 0
      const set: any = {}
      
      // Always update making charge (even if 0) to ensure field exists
      set.karigarMakingCharge = Number((p.karigarMC + addMC).toFixed(6))
      
      // Always update goldRecovered (even if 0) to ensure field exists
      set.goldRecovered = Number((p.recovered + addRec).toFixed(6))
      
      // ALWAYS mark as fully recovered in this recovery flow
      set.isFullyRecovered = true
      
      return {
        updateOne: {
          filter: { _id: p.id },
          update: { $set: set }
        }
      }
    })

    // Execute updates
    if (bulkOps.length > 0) await processesCol.bulkWrite(bulkOps)

    // Compute fine gold addition per karat for recoveryAmount
    const recoveryAdds = perProcessAfterMC.map(p => {
      const addRec = raUpdates.find(u => u.id.equals(p.id))?.addRecovered || 0
      return { karatPurity: p.karatPurity, addRecovered: addRec }
    })

    const fineByKarat = recoveryAdds.reduce((acc: Record<string, number>, item) => {
      if (item.addRecovered > 0) {
        const key = String(item.karatPurity)
        const fine = item.addRecovered * (item.karatPurity / 100)
        acc[key] = (acc[key] || 0) + fine
      }
      return acc
    }, {})

    const totalFineAdded = Object.values(fineByKarat).reduce((s, x) => s + x, 0)

    // Update inventory
    const now = new Date()
    const inventory = await inventoryCol.findOne({})
    if (inventory) {
      await inventoryCol.updateOne(
        { _id: inventory._id },
        { 
          $inc: { 
            adminStock: totalFineAdded, // Keep for backward compatibility
            karigarLossStock: -truncateToThreeDecimals(totalPendingBefore), // Deduct full pending loss
            recoveredStock: truncateToThreeDecimals(recoveryAmount) // Add actual recovered amount
          }, 
          $set: { lastUpdated: now } 
        }
      )
    }


    // Create a single transaction summarizing recovery
    const txDescription = `Enhanced recovery for karigar ${karigar.name}: making ${makingCharge.toFixed(3)}g + recovery ${recoveryAmount.toFixed(3)}g (fine added ${totalFineAdded.toFixed(3)}g)`
    let txId: ObjectId | null = null
    if (totalFineAdded > 0) {
      const tx = await transactionsCol.insertOne({
        type: TransactionType.GOLD_RECOVERY,
        amount: totalFineAdded,
        description: txDescription,
        recoveredGold: totalFineAdded,
        karatPurity: null,
        originalKaratAmount: recoveryAmount,
        createdAt: now,
        updatedAt: now
      })
      txId = tx.insertedId
    }

    // Remaining balance after both steps
    const totalPendingAfter = perProcessAfterMC.reduce((s, p) => s + Math.max(0, Math.max(0, p.goldLoss - (p.karigarMC + (mcUpdates.find(u => u.id.equals(p.id))?.addMakingCharge || 0))) - (p.recovered + (raUpdates.find(u => u.id.equals(p.id))?.addRecovered || 0))), 0)

    // Save recovery history record
    await recoveryHistoryCol.insertOne({
      karigarId: id,
      karigarName: karigar.name,
      totalRecoveryAmount: Number((makingCharge + recoveryAmount).toFixed(6)),
      makingCharge: Number(makingCharge.toFixed(6)),
      actualRecoveryAmount: Number(recoveryAmount.toFixed(6)),
      remainingBalance: Number(totalPendingAfter.toFixed(6)),
      karatPurity: null,
      karatLabel: karatFilter && karatFilter !== 'all' ? karatFilter : 'Mixed',
      recoveryType: 'ENHANCED_RECOVERY_BATCH',
      description: description || 'Batch recovery with making charge and partial/full recovery',
      fineGoldRecovered: Number(totalFineAdded.toFixed(6)),
      transactionId: txId,
      processesAffected: processesWithKarat.length,
      totalLossBeforeRecovery: totalPendingBefore,
      totalRecoveredBeforeThis: 0,
      createdAt: now,
      updatedAt: now
    })

    return NextResponse.json({
      success: true,
      message: 'Enhanced recovery completed',
      summary: {
        processesUpdated: processesWithKarat.length,
        makingChargeApplied: Number(makingCharge.toFixed(6)),
        recoveryApplied: Number(recoveryAmount.toFixed(6)),
        fineGoldAdded: Number(totalFineAdded.toFixed(6)),
        remainingPending: Number(totalPendingAfter.toFixed(6)),
        fineByKarat,
      }
    })
  } catch (error) {
    console.error('Error in enhanced recovery:', error)
    return NextResponse.json({ error: 'Failed to complete enhanced recovery' }, { status: 500 })
  }
}

