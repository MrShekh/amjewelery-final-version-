import { NextRequest } from 'next/server'
import { 
  getOrdersCollection, 
  getManufacturingProcessesCollection, 
  getGoldTransactionsCollection, 
  getInventoryCollection,
  getBillsCollection,
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

// GET /api/reports/summary - Get dashboard summary statistics
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

    // Parse query parameters for date filtering
    const { searchParams } = new URL(request.url)
    const dateFilter = searchParams.get('dateFilter') || 'all' // today, week, month, year, custom, all
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build date filter query
    let dateQuery: any = {}
    const now = new Date()
    
    switch (dateFilter) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        dateQuery = { createdAt: { $gte: todayStart, $lt: todayEnd } }
        break
      case 'week':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        dateQuery = { createdAt: { $gte: weekStart } }
        break
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        dateQuery = { createdAt: { $gte: monthStart } }
        break
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        dateQuery = { createdAt: { $gte: yearStart } }
        break
      case 'custom':
        if (startDate && endDate) {
          dateQuery = { 
            createdAt: { 
              $gte: new Date(startDate), 
              $lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)
            } 
          }
        }
        break
      // 'all' case: no date filter
    }

    const ordersCol = await getOrdersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const inventoryCol = await getInventoryCollection()
    const billsCol = await getBillsCollection()

    // Get order statistics
    const orderStats = await ordersCol.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalGoldUsed: { $sum: '$totalGoldUsed' },
          totalFinalWeight: { $sum: '$finalJewelryWeight' },
          avgGoldUsed: { $avg: '$totalGoldUsed' }
        }
      }
    ]).toArray()

    // Get manufacturing process statistics
    const processStats = await processesCol.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$processType',
          count: { $sum: 1 },
          totalInput: { $sum: '$inputWeight' },
          totalOutput: { $sum: '$outputWeight' },
          totalLoss: { $sum: '$goldLoss' },
          avgLoss: { $avg: '$goldLoss' }
        }
      }
    ]).toArray()

    // Get transaction statistics
    const transactionStats = await transactionsCol.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalRecovered: { $sum: '$recoveredGold' }
        }
      }
    ]).toArray()

    // Get financial statistics from bills
    const billStats = await billsCol.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalManufacturingCost: { $sum: '$manufacturingCost' },
          totalBillAmount: { $sum: '$totalAmount' },
          avgManufacturingCost: { $avg: '$manufacturingCost' }
        }
      }
    ]).toArray()

    // Get current inventory status
    const currentInventory = await inventoryCol.findOne({})

    // Get karat-wise statistics
    const karatStats = await ordersCol.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$selectedKarat',
          count: { $sum: 1 },
          totalWeight: { $sum: '$finalJewelryWeight' },
          totalGoldUsed: { $sum: '$totalGoldUsed' }
        }
      }
    ]).toArray()

    // Get casting statistics (from transactions with casting description)
    const castingStats = await transactionsCol.aggregate([
      { 
        $match: { 
          ...dateQuery,
          description: { $regex: /casting/i }
        }
      },
      {
        $group: {
          _id: null,
          totalCastingEvents: { $sum: 1 },
          totalFineGoldCast: { $sum: '$amount' }
        }
      }
    ]).toArray()

    // Calculate totals and organize data
    const summary = {
      dateRange: {
        filter: dateFilter,
        startDate: startDate || null,
        endDate: endDate || null,
        generatedAt: new Date()
      },
      orders: {
        total: orderStats.reduce((sum, stat) => sum + stat.count, 0),
        byStatus: orderStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalGoldUsed: stat.totalGoldUsed || 0,
            totalFinalWeight: stat.totalFinalWeight || 0,
            avgGoldUsed: stat.avgGoldUsed || 0
          }
          return acc
        }, {} as any),
        totalGoldUsed: orderStats.reduce((sum, stat) => sum + (stat.totalGoldUsed || 0), 0),
        totalFinalWeight: orderStats.reduce((sum, stat) => sum + (stat.totalFinalWeight || 0), 0)
      },
      manufacturing: {
        totalProcesses: processStats.reduce((sum, stat) => sum + stat.count, 0),
        byProcessType: processStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalInput: stat.totalInput || 0,
            totalOutput: stat.totalOutput || 0,
            totalLoss: stat.totalLoss || 0,
            avgLoss: stat.avgLoss || 0
          }
          return acc
        }, {} as any),
        totalInput: processStats.reduce((sum, stat) => sum + (stat.totalInput || 0), 0),
        totalOutput: processStats.reduce((sum, stat) => sum + (stat.totalOutput || 0), 0),
        totalLoss: processStats.reduce((sum, stat) => sum + (stat.totalLoss || 0), 0)
      },
      transactions: {
        total: transactionStats.reduce((sum, stat) => sum + stat.count, 0),
        byType: transactionStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount || 0,
            totalRecovered: stat.totalRecovered || 0
          }
          return acc
        }, {} as any)
      },
      financial: {
        totalBills: billStats[0]?.totalBills || 0,
        totalManufacturingCost: billStats[0]?.totalManufacturingCost || 0,
        totalBillAmount: billStats[0]?.totalBillAmount || 0,
        avgManufacturingCost: billStats[0]?.avgManufacturingCost || 0
      },
      karat: {
        distribution: karatStats.reduce((acc, stat) => {
          acc[`k${stat._id}`] = {
            count: stat.count,
            totalWeight: stat.totalWeight || 0,
            totalGoldUsed: stat.totalGoldUsed || 0
          }
          return acc
        }, {} as any)
      },
      casting: {
        totalEvents: castingStats[0]?.totalCastingEvents || 0,
        totalFineGoldCast: castingStats[0]?.totalFineGoldCast || 0
      },
      inventory: {
        current: currentInventory ? {
          adminStock: currentInventory.adminStock || 0,
          karigarLossStock: currentInventory.karigarLossStock || 0,
          customerStock: currentInventory.customerStock || 0,
          advanceCustomerStock: currentInventory.advanceCustomerStock || 0
        } : null
      }
    }

    return handleApiSuccess({ summary }, requestId)
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown reports summary error'), requestId)
  }
}
