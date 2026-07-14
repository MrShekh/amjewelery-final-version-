import { NextRequest } from 'next/server'
import { 
  getManufacturingProcessesCollection,
  getOrdersCollection,
  getUsersCollection 
} from '@/lib/mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { ObjectId } from 'mongodb'
import { 
  handleApiError, 
  handleApiSuccess, 
  AuthenticationError,
  generateRequestId 
} from '@/lib/errorHandler'

// GET /api/reports/manufacturing - Get detailed manufacturing processes report
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      throw new AuthenticationError('Authorization token required')
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      throw new AuthenticationError(error instanceof Error ? error.message : 'Invalid token')
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({ 
      _id: new ObjectId(payload.userId),
      isActive: true 
    })

    if (!user) {
      throw new AuthenticationError('User not found or session expired')
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const dateFilter = searchParams.get('dateFilter') || 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const processType = searchParams.get('processType') // filing, polishing, etc.
    const orderNumber = searchParams.get('orderNumber')
    const karat = searchParams.get('karat')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const export_format = searchParams.get('export')

    // Build query filters
    let query: any = {}

    // Date filter
    const now = new Date()
    switch (dateFilter) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        query.createdAt = { $gte: todayStart, $lt: todayEnd }
        break
      case 'week':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        query.createdAt = { $gte: weekStart }
        break
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        query.createdAt = { $gte: monthStart }
        break
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        query.createdAt = { $gte: yearStart }
        break
      case 'custom':
        if (startDate && endDate) {
          query.createdAt = { 
            $gte: new Date(startDate), 
            $lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)
          }
        }
        break
    }

    // Process type filter
    if (processType && processType !== 'all') {
      query.processType = processType
    }

    const processesCol = await getManufacturingProcessesCollection()
    const ordersCol = await getOrdersCollection()

    // Build sort object
    const sortObj: any = {}
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Get processes with order details
    const processes = await processesCol.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'orderDetails'
        }
      },
      {
        $unwind: {
          path: '$orderDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      // Additional filters that require order data
      ...(orderNumber ? [{
        $match: {
          'orderDetails.orderNumber': { $regex: orderNumber, $options: 'i' }
        }
      }] : []),
      ...(karat ? [{
        $match: {
          'orderDetails.selectedKarat': parseFloat(karat)
        }
      }] : []),
      {
        $addFields: {
          lossPercentage: {
            $cond: {
              if: { $gt: ['$inputWeight', 0] },
              then: { $multiply: [{ $divide: ['$goldLoss', '$inputWeight'] }, 100] },
              else: 0
            }
          },
          efficiency: {
            $cond: {
              if: { $gt: ['$inputWeight', 0] },
              then: { $multiply: [{ $divide: ['$outputWeight', '$inputWeight'] }, 100] },
              else: 0
            }
          }
        }
      },
      { $sort: sortObj },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]).toArray()

    // Get total count for pagination
    let totalCount: number
    let countQuery = query
    if (orderNumber || karat) {
      // Need to use aggregation for count when filtering by order fields
      const countPipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'orderDetails'
          }
        },
        {
          $unwind: {
            path: '$orderDetails',
            preserveNullAndEmptyArrays: true
          }
        }
      ]
      
      if (orderNumber) {
        countPipeline.push({
          $match: {
            'orderDetails.orderNumber': { $regex: orderNumber, $options: 'i' }
          }
        } as any)
      }
      
      if (karat) {
        countPipeline.push({
          $match: {
            'orderDetails.selectedKarat': parseFloat(karat)
          }
        } as any)
      }
      
      countPipeline.push({ $count: 'total' } as any)
      
      const countResult = await processesCol.aggregate(countPipeline).toArray()
      totalCount = countResult[0]?.total || 0
    } else {
      totalCount = await processesCol.countDocuments(query)
    }

    // Get summary statistics
    const summaryPipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'orderDetails'
        }
      },
      {
        $unwind: {
          path: '$orderDetails',
          preserveNullAndEmptyArrays: true
        }
      }
    ]

    // Apply additional filters for summary
    if (orderNumber) {
      summaryPipeline.push({
        $match: {
          'orderDetails.orderNumber': { $regex: orderNumber, $options: 'i' }
        }
      } as any)
    }
    
    if (karat) {
      summaryPipeline.push({
        $match: {
          'orderDetails.selectedKarat': parseFloat(karat)
        }
      } as any)
    }

    summaryPipeline.push({
      $group: {
        _id: null,
        totalProcesses: { $sum: 1 },
        totalInputWeight: { $sum: '$inputWeight' },
        totalOutputWeight: { $sum: '$outputWeight' },
        totalGoldLoss: { $sum: '$goldLoss' },
        totalAdditionalWeight: { $sum: '$additionalWeight' },
        avgInputWeight: { $avg: '$inputWeight' },
        avgOutputWeight: { $avg: '$outputWeight' },
        avgGoldLoss: { $avg: '$goldLoss' },
        processTypeDistribution: { $push: '$processType' },
        karatDistribution: { $push: '$orderDetails.selectedKarat' }
      }
    } as any)

    const summaryStats = await processesCol.aggregate(summaryPipeline).toArray()

    // Process type efficiency analysis
    const efficiencyPipeline = [...summaryPipeline.slice(0, -1)]
    efficiencyPipeline.push({
      $group: {
        _id: '$processType',
        count: { $sum: 1 },
        totalInput: { $sum: '$inputWeight' },
        totalOutput: { $sum: '$outputWeight' },
        totalLoss: { $sum: '$goldLoss' },
        avgLoss: { $avg: '$goldLoss' },
        avgEfficiency: { 
          $avg: { 
            $cond: {
              if: { $gt: ['$inputWeight', 0] },
              then: { $multiply: [{ $divide: ['$outputWeight', '$inputWeight'] }, 100] },
              else: 0
            }
          }
        }
      }
    } as any)

    const efficiencyStats = await processesCol.aggregate(efficiencyPipeline).toArray()

    // Calculate distributions
    let processTypeCounts: Record<string, number> = {}
    let karatCounts: Record<string, number> = {}
    
    if (summaryStats.length > 0) {
      summaryStats[0].processTypeDistribution.forEach((type: string) => {
        processTypeCounts[type] = (processTypeCounts[type] || 0) + 1
      })

      summaryStats[0].karatDistribution.forEach((karat: number) => {
        if (karat) {
          const karatKey = `k${karat}`
          karatCounts[karatKey] = (karatCounts[karatKey] || 0) + 1
        }
      })
    }

    const result = {
      filters: {
        dateFilter,
        startDate: startDate || null,
        endDate: endDate || null,
        processType: processType || null,
        orderNumber: orderNumber || null,
        karat: karat || null
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      },
      sorting: {
        sortBy,
        sortOrder
      },
      summary: {
        totalProcesses: summaryStats[0]?.totalProcesses || 0,
        totalInputWeight: summaryStats[0]?.totalInputWeight || 0,
        totalOutputWeight: summaryStats[0]?.totalOutputWeight || 0,
        totalGoldLoss: summaryStats[0]?.totalGoldLoss || 0,
        totalAdditionalWeight: summaryStats[0]?.totalAdditionalWeight || 0,
        avgInputWeight: summaryStats[0]?.avgInputWeight || 0,
        avgOutputWeight: summaryStats[0]?.avgOutputWeight || 0,
        avgGoldLoss: summaryStats[0]?.avgGoldLoss || 0,
        overallLossPercentage: summaryStats[0]?.totalInputWeight > 0 ? 
          ((summaryStats[0]?.totalGoldLoss || 0) / summaryStats[0].totalInputWeight) * 100 : 0,
        overallEfficiency: summaryStats[0]?.totalInputWeight > 0 ? 
          ((summaryStats[0]?.totalOutputWeight || 0) / summaryStats[0].totalInputWeight) * 100 : 0,
        processTypeDistribution: processTypeCounts,
        karatDistribution: karatCounts
      },
      processEfficiency: efficiencyStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalInput: stat.totalInput,
          totalOutput: stat.totalOutput,
          totalLoss: stat.totalLoss,
          avgLoss: stat.avgLoss,
          avgEfficiency: stat.avgEfficiency,
          lossPercentage: stat.totalInput > 0 ? (stat.totalLoss / stat.totalInput) * 100 : 0
        }
        return acc
      }, {} as any),
      processes: processes.map(process => ({
        id: process._id,
        orderId: process.orderId,
        orderNumber: process.orderDetails?.orderNumber || 'N/A',
        customerName: process.orderDetails?.customerName || 'N/A',
        processType: process.processType,
        sequence: process.sequence,
        selectedKarat: process.orderDetails?.selectedKarat || 0,
        inputWeight: process.inputWeight || 0,
        outputWeight: process.outputWeight || 0,
        goldLoss: process.goldLoss || 0,
        additionalWeight: process.additionalWeight || 0,
        lossPercentage: process.lossPercentage || 0,
        efficiency: process.efficiency || 0,
        createdAt: process.createdAt,
        completedAt: process.completedAt || null,
        description: process.description || '',
        isCompleted: !!process.completedAt
      }))
    }

    // Handle export format
    if (export_format) {
      return handleApiSuccess({ 
        export: true, 
        format: export_format, 
        data: result 
      }, requestId)
    }

    return handleApiSuccess(result, requestId)
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown manufacturing report error'), requestId)
  }
}
