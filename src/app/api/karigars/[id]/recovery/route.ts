import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { ManufacturingProcess } from '@/types/mongodb'
import { ObjectId } from 'mongodb'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await connectToDatabase()
    const resolvedParams = await params
    const karigarId = resolvedParams.id
    const body = await request.json()
    
    const { processType, recoveryAmount, markAsRecovered = false, description } = body

    if (!processType || (!recoveryAmount && !markAsRecovered)) {
      return NextResponse.json(
        { error: 'Valid processType and either recoveryAmount or markAsRecovered flag are required' },
        { status: 400 }
      )
    }

    // Get all processes for this karigar and process type that have adminRecoverable gold
    const processes = await db.collection<ManufacturingProcess>('processes')
      .find({ 
        karigarId: karigarId,
        processType: processType,
        adminRecoverable: { $gt: 0 }
      })
      .toArray()

    if (processes.length === 0) {
      return NextResponse.json(
        { error: `No recoverable processes found for karigar with process type ${processType}` },
        { status: 404 }
      )
    }

    // Calculate total recoverable amount
    const totalRecoverable = processes.reduce((sum, p) => sum + (p.adminRecoverable || 0), 0)
    const totalRecovered = processes.reduce((sum, p) => sum + (p.goldRecovered || 0), 0)
    const pendingRecoverable = totalRecoverable - totalRecovered
    
    // Amount to be recovered in this operation
    let amountToRecover = markAsRecovered ? pendingRecoverable : recoveryAmount
    
    if (amountToRecover <= 0) {
      return NextResponse.json(
        { error: 'Recovery amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (amountToRecover > pendingRecoverable) {
      return NextResponse.json(
        { error: `Recovery amount (${amountToRecover}g) cannot exceed pending recoverable amount (${pendingRecoverable.toFixed(3)}g)` },
        { status: 400 }
      )
    }

    // Distribute recovery proportionally across processes
    let remainingRecovery = amountToRecover
    const updatedProcesses: any[] = []

    for (let i = 0; i < processes.length; i++) {
      const process = processes[i]
      const currentPending = (process.adminRecoverable || 0) - (process.goldRecovered || 0)
      
      if (currentPending <= 0) continue
      
      let processRecovery = 0

      if (i === processes.length - 1 || markAsRecovered) {
        // Last process gets any remaining recovery to handle rounding
        // Or if marking all as recovered, recover the full pending amount
        processRecovery = Math.min(remainingRecovery, currentPending)
      } else {
        // Proportional distribution
        const proportion = currentPending / pendingRecoverable
        processRecovery = Math.min(remainingRecovery, amountToRecover * proportion)
      }
      
      remainingRecovery -= processRecovery

      // Calculate new total recovered
      const newGoldRecovered = (process.goldRecovered || 0) + processRecovery

      // Update the process
      const updateResult = await db.collection<ManufacturingProcess>('processes').updateOne(
        { _id: process._id },
        { 
          $set: {
            goldRecovered: newGoldRecovered,
            isFullyRecovered: newGoldRecovered >= (process.adminRecoverable || 0) || Math.abs(newGoldRecovered - (process.adminRecoverable || 0)) <= 0.005,
            updatedAt: new Date()
          }
        }
      )

      if (updateResult.matchedCount === 0) {
        console.error(`Failed to update process ${process._id}`)
        continue
      }

      updatedProcesses.push({
        id: process._id?.toString(),
        orderId: process.orderId,
        processType: process.processType,
        adminRecoverable: process.adminRecoverable,
        previouslyRecovered: process.goldRecovered || 0,
        currentRecovery: processRecovery,
        totalRecovered: newGoldRecovered,
        isFullyRecovered: newGoldRecovered >= (process.adminRecoverable || 0) || Math.abs(newGoldRecovered - (process.adminRecoverable || 0)) <= 0.005
      })
    }

    // Create a transaction record for the recovery
    await db.collection('transactions').insertOne({
      _id: new ObjectId(),
      karigarId: karigarId,
      type: 'GOLD_RECOVERY',
      amount: amountToRecover,
      description: description || `Gold recovery from ${processType} processes - ${amountToRecover}g`,
      recoveredGold: amountToRecover,
      processType: processType,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return NextResponse.json({
      message: `Recovered ${amountToRecover}g of gold from ${processType} processes`,
      processType,
      totalRecoverable,
      totalRecovered: totalRecovered + amountToRecover,
      amountRecovered: amountToRecover,
      remainingRecoverable: pendingRecoverable - amountToRecover,
      processesUpdated: updatedProcesses.length,
      updatedProcesses
    })

  } catch (error) {
    console.error('Error recording gold recovery:', error)
    return NextResponse.json(
      { error: 'Failed to record gold recovery' },
      { status: 500 }
    )
  }
}
