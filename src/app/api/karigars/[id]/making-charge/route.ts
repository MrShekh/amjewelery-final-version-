import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { ManufacturingProcess, TransactionType } from '@/types/mongodb'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await connectToDatabase()
    const resolvedParams = await params
    const karigarId = resolvedParams.id
    const body = await request.json()
    
    const { processType, makingChargeAmount, description } = body

    if (!processType || makingChargeAmount === undefined || makingChargeAmount < 0) {
      return NextResponse.json(
        { error: 'Valid processType and makingChargeAmount are required' },
        { status: 400 }
      )
    }

    console.log(`Setting making charge for karigar ${karigarId}, process ${processType}: ${makingChargeAmount}g`)

    // Get all processes for this karigar and process type
    const processes = await db.collection<ManufacturingProcess>('processes')
      .find({ 
        karigarId: karigarId,
        processType: processType,
        goldLoss: { $gt: 0 } // Only processes with actual loss
      })
      .toArray()

    if (processes.length === 0) {
      return NextResponse.json(
        { error: `No processes found for karigar with process type ${processType}` },
        { status: 404 }
      )
    }

    // Calculate total loss for this process type
    const safeNumber = (value: any): number => {
      const num = parseFloat(String(value || 0))
      return isNaN(num) ? 0 : num
    }
    
    const totalLoss = processes.reduce((sum, p) => sum + safeNumber(p.goldLoss), 0)
    
    if (makingChargeAmount > totalLoss) {
      return NextResponse.json(
        { error: `Making charge amount (${makingChargeAmount}g) cannot exceed total loss (${totalLoss.toFixed(3)}g) for ${processType}` },
        { status: 400 }
      )
    }

    // Distribute making charge proportionally across processes
    let remainingMakingCharge = makingChargeAmount
    const updatedProcesses: any[] = []

    for (let i = 0; i < processes.length; i++) {
      const process = processes[i]
      let processMakingCharge = 0

      if (i === processes.length - 1) {
        // Last process gets any remaining charge to handle rounding
        processMakingCharge = remainingMakingCharge
      } else {
      // Proportional distribution
      const proportion = safeNumber(process.goldLoss) / totalLoss
      processMakingCharge = Math.min(remainingMakingCharge, makingChargeAmount * proportion)
        remainingMakingCharge -= processMakingCharge
      }

    // Calculate values in karat gold (process gold purity)
    const karigarMakingCharge = processMakingCharge
    const adminRecoverable = Math.max(0, safeNumber(process.goldLoss) - processMakingCharge)

      // Update the process
      const updateResult = await db.collection<ManufacturingProcess>('processes').updateOne(
        { _id: process._id },
        { 
          $set: {
            karigarMakingCharge: karigarMakingCharge,
            adminRecoverable: adminRecoverable,
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
        goldLoss: process.goldLoss,
        karigarMakingCharge: karigarMakingCharge,
        adminRecoverable: adminRecoverable
      })
    }

    // Create a transaction record for the making charge setting
    await db.collection('transactions').insertOne({
      _id: new ObjectId(),
      type: TransactionType.KARIGAR_SALARY,
      amount: makingChargeAmount,
      description: description || `Making charge set for ${processType} processes - ${makingChargeAmount}g`,
      recoveredGold: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    console.log(`Successfully updated ${updatedProcesses.length} processes with making charges`)

    return NextResponse.json({
      message: `Making charge of ${makingChargeAmount}g set for ${processType} processes`,
      processType,
      totalLoss: totalLoss,
      makingChargeSet: makingChargeAmount,
      totalAdminRecoverable: totalLoss - makingChargeAmount,
      processesUpdated: updatedProcesses.length,
      updatedProcesses
    })

  } catch (error) {
    console.error('Error setting making charge:', error)
    return NextResponse.json(
      { error: 'Failed to set making charge' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await connectToDatabase()
    const resolvedParams = await params
    const karigarId = resolvedParams.id
    const url = new URL(request.url)
    const processType = url.searchParams.get('processType')

    // Get making charge summary for this karigar
    const matchFilter: any = { karigarId: karigarId }
    if (processType) {
      matchFilter.processType = processType
    }

    const processes = await db.collection<ManufacturingProcess>('processes')
      .find(matchFilter)
      .toArray()

    // Group by process type
    const summary = processes.reduce((acc, process) => {
      if (!acc[process.processType]) {
        acc[process.processType] = {
          processType: process.processType,
          totalLoss: 0,
          totalMakingCharge: 0,
          totalAdminRecoverable: 0,
          totalRecovered: 0,
          processCount: 0
        }
      }

      // Use safeNumber function to handle potential NaN values
      const safeNumber = (value: any): number => {
        const num = parseFloat(String(value || 0))
        return isNaN(num) ? 0 : num
      }
      
      acc[process.processType].totalLoss += safeNumber(process.goldLoss)
      acc[process.processType].totalMakingCharge += safeNumber(process.karigarMakingCharge)
      acc[process.processType].totalAdminRecoverable += safeNumber(process.adminRecoverable)
      acc[process.processType].totalRecovered += safeNumber(process.goldRecovered)
      acc[process.processType].processCount += 1

      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      karigarId,
      summary: Object.values(summary)
    })

  } catch (error) {
    console.error('Error fetching making charge summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch making charge summary' },
      { status: 500 }
    )
  }
}
