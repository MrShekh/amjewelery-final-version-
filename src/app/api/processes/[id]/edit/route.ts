import { NextRequest, NextResponse } from 'next/server'
import { getManufacturingProcessesCollection, getOrdersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

interface ProcessUpdateData {
  inputWeight: number
  outputWeight: number
  goldLoss: number
  adStonesAdded?: Array<{ sizeMm: number, pieces: number, totalWeight: number }>
  kalesStonesAdded?: Array<{ sizeMm: number, pieces: number, totalWeight: number }>
  originalInputWeight: number
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params

    if (!ObjectId.isValid(processId)) {
      return NextResponse.json(
        { error: 'Invalid process ID format' },
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

    const updateData: ProcessUpdateData = await request.json()
    const {
      inputWeight,
      outputWeight,
      goldLoss,
      adStonesAdded,
      kalesStonesAdded,
      originalInputWeight
    } = updateData

    console.log('🔧 Process Edit Request:', {
      processId,
      inputWeight,
      outputWeight,
      goldLoss,
      stoneData: {
        adStones: adStonesAdded?.length || 0,
        kalesStones: kalesStonesAdded?.length || 0
      }
    })

    // Validate inputs
    if (inputWeight <= 0) {
      return NextResponse.json(
        { error: 'Input weight must be greater than 0' },
        { status: 400 }
      )
    }

    if (outputWeight < 0) {
      return NextResponse.json(
        { error: 'Output weight cannot be negative' },
        { status: 400 }
      )
    }

    if (outputWeight > inputWeight) {
      return NextResponse.json(
        { error: 'Output weight cannot be greater than input weight' },
        { status: 400 }
      )
    }

    const processesCol = await getManufacturingProcessesCollection()
    const ordersCol = await getOrdersCollection()

    // Check if process exists
    const process = await processesCol.findOne({ _id: new ObjectId(processId) })
    if (!process) {
      return NextResponse.json(
        { error: 'Process not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateFields: any = {
      inputWeight: Number(inputWeight.toFixed(6)),
      outputWeight: Number(outputWeight.toFixed(6)),
      goldLoss: Number(goldLoss.toFixed(6)),
      originalInputWeight: Number(originalInputWeight.toFixed(6)),
      lastUpdated: new Date(),
      updatedBy: payload.userId
    }

    // Add stone data for STONE_SETTING processes
    if (process.processType === 'STONE_SETTING') {
      updateFields.adStonesAdded = adStonesAdded || []
      updateFields.kalesStonesAdded = kalesStonesAdded || []
    }

    // Update the process
    const result = await processesCol.updateOne(
      { _id: new ObjectId(processId) },
      { $set: updateFields }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Process not found' },
        { status: 404 }
      )
    }

    // Get the updated process for response
    const updatedProcess = await processesCol.findOne({ _id: new ObjectId(processId) })

    // Update order's processWorkflow to reflect the changes
    if (process.orderId) {
      const order = await ordersCol.findOne({ _id: new ObjectId(process.orderId) })

      if (order && order.processWorkflow?.processesCompleted) {
        // Find and update the process in the workflow
        const updatedProcessesCompleted = order.processWorkflow.processesCompleted.map((p: any) => {
          // Match by sequence number or process type and karigar
          if (p.sequence === process.sequence ||
            (p.processType === process.processType && p.karigarId === process.karigarId)) {
            return {
              ...p,
              inputWeight: inputWeight,
              outputWeight: outputWeight,
              goldLoss: goldLoss,
              ...(process.processType === 'STONE_SETTING' && {
                stonesAdded: {
                  adStones: adStonesAdded,
                  kalesStones: kalesStonesAdded,
                  totalStoneWeight: (adStonesAdded || []).reduce((sum: number, stone: any) => sum + (stone.totalWeight || 0), 0) +
                    (kalesStonesAdded || []).reduce((sum: number, stone: any) => sum + (stone.totalWeight || 0), 0)
                }
              })
            }
          }
          return p
        })

        // Recalculate total weight loss from all processes
        const totalWeightLoss = updatedProcessesCompleted.reduce((sum: number, p: any) => sum + (p.goldLoss || 0), 0)

        // Calculate actual final weight from the last completed process
        const sortedProcesses = [...updatedProcessesCompleted].sort((a: any, b: any) => b.sequence - a.sequence)
        const actualFinalWeight = sortedProcesses.length > 0 ? sortedProcesses[0].outputWeight : order.originalOrderWeight

        // Update the order
        await ordersCol.updateOne(
          { _id: new ObjectId(process.orderId) },
          {
            $set: {
              'processWorkflow.processesCompleted': updatedProcessesCompleted,
              totalWeightLoss: totalWeightLoss,
              actualFinalWeight: actualFinalWeight,
              updatedAt: new Date()
            }
          }
        )

        console.log(`📝 Updated order ${process.orderId} workflow:`, {
          totalWeightLoss: totalWeightLoss.toFixed(3),
          actualFinalWeight: actualFinalWeight.toFixed(3)
        })
      }
    }

    // Calculate stone totals for response
    const adStoneWeight = (adStonesAdded || []).reduce((sum, stone) => sum + (stone.totalWeight || 0), 0)
    const kalesStoneWeight = (kalesStonesAdded || []).reduce((sum, stone) => sum + (stone.totalWeight || 0), 0)
    const totalStoneWeight = adStoneWeight + kalesStoneWeight

    const adStonePieces = (adStonesAdded || []).reduce((sum, stone) => sum + (stone.pieces || 0), 0)
    const kalesStonePieces = (kalesStonesAdded || []).reduce((sum, stone) => sum + (stone.pieces || 0), 0)
    const totalStonePieces = adStonePieces + kalesStonePieces

    console.log(`✅ Process ${processId} updated successfully`)
    console.log(`📊 New values:`, {
      inputWeight: inputWeight.toFixed(3),
      outputWeight: outputWeight.toFixed(3),
      goldLoss: goldLoss.toFixed(3),
      totalStoneWeight: totalStoneWeight.toFixed(3),
      totalStonePieces
    })

    return NextResponse.json({
      success: true,
      message: 'Process updated successfully',
      process: {
        id: processId,
        inputWeight: inputWeight,
        outputWeight: outputWeight,
        goldLoss: goldLoss,
        originalInputWeight: originalInputWeight,
        totalStoneWeight: totalStoneWeight,
        totalStonePieces: totalStonePieces,
        adStones: {
          count: (adStonesAdded || []).length,
          totalWeight: adStoneWeight,
          totalPieces: adStonePieces
        },
        kalesStones: {
          count: (kalesStonesAdded || []).length,
          totalWeight: kalesStoneWeight,
          totalPieces: kalesStonePieces
        },
        lastUpdated: updateFields.lastUpdated
      },
      changes: {
        inputWeightChange: inputWeight - (process.inputWeight || 0),
        outputWeightChange: outputWeight - (process.outputWeight || 0),
        goldLossChange: goldLoss - (process.goldLoss || 0)
      }
    })


  } catch (error) {
    console.error('Error updating process:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
