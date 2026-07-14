import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getCustomersCollection, getManufacturingProcessesCollection, getGoldTransactionsCollection, getInventoryCollection, getKarigarsCollection, getCustomerJamaBalancesCollection, getUsersCollection } from '@/lib/mongodb'
import { Order, OrderStatus, TransactionType, GoldTransaction, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import {
  handleApiError,
  handleApiSuccess,
  AuthenticationError,
  ValidationError,
  generateRequestId
} from '@/lib/errorHandler'

// GET /api/orders - Get all orders (paginated)
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const customerId = searchParams.get('customerId')
  const pageParam = searchParams.get('page') || '1'
  const limitParam = searchParams.get('limit') || '10'
  const search = searchParams.get('search') || ''
  const dateFilter = searchParams.get('dateFilter') || 'all'
  const karatFilter = searchParams.get('karatFilter') || 'all'

  const page = Math.max(parseInt(pageParam, 10) || 1, 1)
  const limit = Math.max(Math.min(parseInt(limitParam, 10) || 10, 100), 1)

  try {
    console.log(`[${requestId}] Starting GET /api/orders request`)
    console.log(`[${requestId}] Query params:`, { status, customerId, page, limit, search })

    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)

    console.log(`[${requestId}] Token exists:`, !!token)

    if (!token) {
      throw new AuthenticationError('Authorization token required')
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyToken(token)
      console.log(`[${requestId}] Token verified for user:`, payload.userId)
    } catch (error) {
      console.error(`[${requestId}] Token verification failed:`, error)
      throw new AuthenticationError(error instanceof Error ? error.message : 'Invalid token')
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({
      _id: new ObjectId(payload.userId),
      isActive: true
    })

    if (!user) {
      console.error(`[${requestId}] User not found:`, payload.userId)
      throw new AuthenticationError('User not found or session expired')
    }

    console.log(`[${requestId}] User authenticated:`, user.email)

    const ordersCol = await getOrdersCollection()
    const customersCol = await getCustomersCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const karigarsCol = await getKarigarsCollection()

    // Build query filter
    const filter: Record<string, any> = {}
    if (status) filter.status = status as OrderStatus
    if (customerId) filter.customerId = customerId

    // Apply karat filter
    if (karatFilter !== 'all') {
      const parsedKarat = parseFloat(karatFilter)
      if (!isNaN(parsedKarat)) {
        filter.selectedKarat = parsedKarat
      }
    }

    // Apply search on order fields and customer name
    if (search) {
      const searchRegex = new RegExp(search, 'i')

      // Find customers matching search to filter by customerId
      const matchingCustomers = await customersCol.find(
        { name: searchRegex },
        { projection: { _id: 1 } }
      ).toArray()
      const matchingCustomerIds = matchingCustomers.map((c: any) => c._id.toString())

      const orConditions: Record<string, any>[] = [
        { orderName: { $regex: searchRegex } },
        { orderNumber: { $regex: searchRegex } },
      ]

      const searchAsNumber = Number(search)
      if (!isNaN(searchAsNumber)) {
        orConditions.push({ orderNumber: searchAsNumber })
      }

      if (matchingCustomerIds.length > 0) {
        orConditions.push({ customerId: { $in: matchingCustomerIds } })
      }

      filter.$or = orConditions
    }

    // Apply date or month filter
    const monthFilter = searchParams.get('monthFilter')
    if (monthFilter && monthFilter !== 'all') {
      const [yearStr, monthStr] = monthFilter.split('-')
      const year = Number(yearStr)
      const month = Number(monthStr) || 1
      const startDate = new Date(Date.UTC(year, month - 1, 1, -5, -30))
      const endDate = new Date(Date.UTC(year, month, 1, -5, -30))
      filter.createdAt = { $gte: startDate, $lt: endDate }
    } else if (dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date | null = null

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now)
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now)
          startDate.setMonth(now.getMonth() - 1)
          break
      }

      if (startDate) {
        filter.createdAt = { $gte: startDate }
      }
    }

    console.log(`[${requestId}] Query filter:`, filter)

    const totalCount = await ordersCol.countDocuments(filter)
    console.log(`[${requestId}] Total matching orders: ${totalCount}`)

    if (totalCount === 0) {
      console.log(`[${requestId}] No orders found with filter:`, filter)
      return handleApiSuccess({ orders: [], page, limit, totalCount, totalPages: 0 }, requestId)
    }

    const skip = (page - 1) * limit

    const orders = await ordersCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    console.log(`[${requestId}] Found ${orders.length} orders in database for current page`)

    // Get related data for each order
    console.log(`[${requestId}] Processing ${orders.length} orders...`)
    const ordersWithDetails = await Promise.all(
      orders.map(async (order, index) => {
        try {
          const orderId = order._id.toString()
          console.log(`[${requestId}] Processing order ${index + 1}/${orders.length}: ${orderId}`)

          // Get customer
          const customer = await customersCol.findOne({ _id: new ObjectId(order.customerId) })
          console.log(`[${requestId}] Customer found for order ${orderId}:`, !!customer)

          // Get processes with karigar info
          const processes = await processesCol.find({ orderId }).sort({ sequence: 1 }).toArray()
          console.log(`[${requestId}] Found ${processes.length} processes for order ${orderId}`)

          const processesWithKarigar = await Promise.all(
            processes.map(async (process) => {
              try {
                const karigar = await karigarsCol.findOne({ _id: new ObjectId(process.karigarId) })
                return {
                  ...toClientFormat(process),
                  karigar: karigar ? toClientFormat(karigar) : null
                }
              } catch (processError) {
                console.error(`[${requestId}] Error processing process:`, processError)
                return {
                  ...toClientFormat(process),
                  karigar: null
                }
              }
            })
          )

          // Get transactions
          const transactions = await transactionsCol.find({ orderId }).sort({ createdAt: -1 }).toArray()
          console.log(`[${requestId}] Found ${transactions.length} transactions for order ${orderId}`)

          return {
            ...toClientFormat(order),
            customer: customer ? toClientFormat(customer) : null,
            processes: processesWithKarigar,
            transactions: transactions.map(t => toClientFormat(t))
          }
        } catch (orderError) {
          console.error(`[${requestId}] Error processing order ${order._id}:`, orderError)
          // Return basic order info even if details fail
          return {
            ...toClientFormat(order),
            customer: null,
            processes: [],
            transactions: []
          }
        }
      })
    )

    // Calculate totals for ALL matching orders (not just current page)
    const allOrdersForTotals = await ordersCol.find(filter, {
      projection: {
        fillingIn: 1,
        fillingOut: 1,
        fillingLoss: 1,
        settingLoss: 1,
        ad: 1,
        klStone: 1,
        polishLoss: 1,
        finishWeight: 1,
        makingCharge: 1,
        fillingKarigar: 1,
        settingKarigar: 1,
        polishKarigar: 1,
        selectedKarat: 1
      }
    }).toArray()

    const totals = {
      fillingIn: 0,
      fillingOut: 0,
      fillingLoss: 0,
      settingLoss: 0,
      ad: 0,
      klStone: 0,
      polishLoss: 0,
      finishWeight: 0,
      makingCharge: 0,
    }

    const uniqueFillingKarigars = new Set<string>()
    const uniqueSettingKarigars = new Set<string>()
    const uniquePolishKarigars = new Set<string>()

    // Helper to get karat display label
    const getKaratLabel = (karat?: number): string => {
      if (!karat) return 'Unknown Karat'
      switch (karat) {
        case 92: return '22k (92%)'
        case 75.5: return '18k (75.5%)'
        case 80: return '19.2k (80%)'
        case 75: return '18k (75%)'
        case 76: return '18k (76%)'
        case 88: return '21k (88%)'
        case 59: return '14k (59%)'
        case 37.5: return '9k (37.5%)'
        default: return `${karat}%`
      }
    }

    // Nested structure: { karatLabel: { karigarName: loss } }
    const fillingKarigarLosses: Record<string, Record<string, number>> = {}
    const fillingKarigarIn: Record<string, Record<string, number>> = {}
    const settingKarigarLosses: Record<string, Record<string, number>> = {}
    const polishKarigarLosses: Record<string, Record<string, number>> = {}

    allOrdersForTotals.forEach((o: any) => {
      totals.fillingIn += o.fillingIn || 0
      totals.fillingOut += o.fillingOut || 0
      totals.fillingLoss += o.fillingLoss || 0
      totals.settingLoss += o.settingLoss || 0
      totals.ad += o.ad || 0
      totals.klStone += o.klStone || 0
      totals.polishLoss += o.polishLoss || 0
      totals.finishWeight += o.finishWeight || 0
      totals.makingCharge += o.makingCharge || 0

      const karatLabel = getKaratLabel(o.selectedKarat)

      if (o.fillingKarigar) {
        const fk = o.fillingKarigar.trim()
        if (fk) {
          uniqueFillingKarigars.add(fk)
          if (!fillingKarigarLosses[karatLabel]) fillingKarigarLosses[karatLabel] = {}
          fillingKarigarLosses[karatLabel][fk] = (fillingKarigarLosses[karatLabel][fk] || 0) + (o.fillingLoss || 0)

          if (!fillingKarigarIn[karatLabel]) fillingKarigarIn[karatLabel] = {}
          fillingKarigarIn[karatLabel][fk] = (fillingKarigarIn[karatLabel][fk] || 0) + (o.fillingIn || 0)
        }
      }
      if (o.settingKarigar) {
        const sk = o.settingKarigar.trim()
        if (sk) {
          uniqueSettingKarigars.add(sk)
          if (!settingKarigarLosses[karatLabel]) settingKarigarLosses[karatLabel] = {}
          settingKarigarLosses[karatLabel][sk] = (settingKarigarLosses[karatLabel][sk] || 0) + (o.settingLoss || 0)
        }
      }
      if (o.polishKarigar) {
        const pk = o.polishKarigar.trim()
        if (pk) {
          uniquePolishKarigars.add(pk)
          if (!polishKarigarLosses[karatLabel]) polishKarigarLosses[karatLabel] = {}
          polishKarigarLosses[karatLabel][pk] = (polishKarigarLosses[karatLabel][pk] || 0) + (o.polishLoss || 0)
        }
      }
    })

    // Round totals
    Object.keys(totals).forEach((key) => {
      const k = key as keyof typeof totals
      totals[k] = parseFloat(totals[k].toFixed(3))
    })

    // Round Karigar losses and fillingIn (nested)
    for (const karatKey of Object.keys(fillingKarigarLosses)) {
      for (const k of Object.keys(fillingKarigarLosses[karatKey])) {
        fillingKarigarLosses[karatKey][k] = parseFloat(fillingKarigarLosses[karatKey][k].toFixed(3))
      }
    }
    for (const karatKey of Object.keys(fillingKarigarIn)) {
      for (const k of Object.keys(fillingKarigarIn[karatKey])) {
        fillingKarigarIn[karatKey][k] = parseFloat(fillingKarigarIn[karatKey][k].toFixed(3))
      }
    }
    for (const karatKey of Object.keys(settingKarigarLosses)) {
      for (const k of Object.keys(settingKarigarLosses[karatKey])) {
        settingKarigarLosses[karatKey][k] = parseFloat(settingKarigarLosses[karatKey][k].toFixed(3))
      }
    }
    for (const karatKey of Object.keys(polishKarigarLosses)) {
      for (const k of Object.keys(polishKarigarLosses[karatKey])) {
        polishKarigarLosses[karatKey][k] = parseFloat(polishKarigarLosses[karatKey][k].toFixed(3))
      }
    }

    console.log(`[${requestId}] Successfully processed ${ordersWithDetails.length} orders`)

    const totalPages = Math.ceil(totalCount / limit)

    return handleApiSuccess({
      orders: ordersWithDetails,
      page,
      limit,
      totalCount,
      totalPages,
      totals,
      fillingKarigarLosses,
      fillingKarigarIn,
      settingKarigarLosses,
      polishKarigarLosses,
      uniqueFillingKarigars: Array.from(uniqueFillingKarigars),
      uniqueSettingKarigars: Array.from(uniqueSettingKarigars),
      uniquePolishKarigars: Array.from(uniquePolishKarigars),
    }, requestId)
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown orders error'), requestId)
  }
}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const {
      customerId,
      orderName,
      orderPhoto,
      orderType,
      finalJewelryWeight, // This is just order detail, not actual stock usage
      adStone, // Legacy single stone support
      kalesStone, // Legacy single stone support
      adStones, // New multiple stones support
      kalesStones, // New multiple stones support
      size, // Add size field
      selectedKarat = 92, // Karat purity selection (default 22k)
      customOrderNumber, // Custom order number from user
      adDetails, // AD details array
      deliveryDate // Delivery date field
    } = body

    // Validation
    if (!customerId || !orderName || !orderType || !finalJewelryWeight) {
      return NextResponse.json(
        { error: 'Customer ID, order name, order type, and final jewelry weight are required' },
        { status: 400 }
      )
    }

    // Validate customer exists
    const customersCol = await getCustomersCollection()
    const customer = await customersCol.findOne({ _id: new ObjectId(customerId) })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Customer advance gold logic removed in simplified model – all orders use admin stock + karigar loss only

    // Handle order number assignment (custom vs auto-generated)
    let orderNumber: string

    if (customOrderNumber && customOrderNumber.trim()) {
      // User provided custom order number - validate uniqueness
      const trimmedCustomNumber = customOrderNumber.trim()
      const ordersCol = await getOrdersCollection()

      // Check if this order number already exists
      const existingOrder = await ordersCol.findOne({ orderNumber: trimmedCustomNumber })
      if (existingOrder) {
        return NextResponse.json(
          { error: `Order number "${trimmedCustomNumber}" already exists. Please choose a different number.` },
          { status: 400 }
        )
      }

      orderNumber = trimmedCustomNumber
    } else {
      // Generate automatic order number
      const generateOrderNumber = async () => {
        const ordersCol = await getOrdersCollection()

        // Get all existing order numbers to find the highest numeric one
        const allOrders = await ordersCol.find(
          { orderNumber: { $exists: true, $ne: null } },
          { projection: { orderNumber: 1 }, sort: { createdAt: -1 } }
        ).toArray()

        let nextNumber = 118 // Start from 118

        if (allOrders && allOrders.length > 0) {
          let highestNumeric = 0
          let highestBag = 0

          // Process all order numbers to find the highest numeric and bag numbers
          for (const order of allOrders) {
            if (order.orderNumber) {
              // Check for numeric format (118, 119, etc.)
              const numericMatch = order.orderNumber.match(/^(\d+)$/)
              if (numericMatch) {
                const num = parseInt(numericMatch[1])
                if (num > highestNumeric) {
                  highestNumeric = num
                }
              }

              // Check for old bag format (bag01, bag02, etc.)
              const bagMatch = order.orderNumber.match(/^bag(\d+)$/)
              if (bagMatch) {
                const bagNum = parseInt(bagMatch[1])
                if (bagNum > highestBag) {
                  highestBag = bagNum
                }
              }
            }
          }

          // Determine next number based on highest found
          if (highestNumeric > 0) {
            // We have numeric orders, increment from highest numeric
            nextNumber = highestNumeric + 1
          } else if (highestBag > 0) {
            // Only old bag format orders exist, convert to new format
            nextNumber = Math.max(118, 117 + highestBag) // Convert bag01 -> 118, bag02 -> 119, etc.
          }
          // If neither found, use default 118
        }

        // Use simple numeric format (118, 119, 120, etc.)
        return nextNumber.toString()
      }

      orderNumber = await generateOrderNumber()
    }

    // Create order and initial transactions
    const ordersCol = await getOrdersCollection()
    const transactionsCol = await getGoldTransactionsCollection()

    const now = new Date()

    // Create the order with simplified approach
    const orderDoc: Order = {
      orderNumber, // Auto-generated order number
      customerId,
      orderName,
      orderPhoto,
      orderType: 'KARIGAR_STOCK', // All orders will use karigar stock for processing
      customerGoldWeight: 0, // Not used in new approach
      adminGoldWeight: 0, // Not used in new approach
      totalGoldUsed: 0, // Will be calculated during processing
      finalJewelryWeight, // This is just order detail/target weight
      manufacturingCost: 0,
      manufacturingCostType: 'money',
      manufacturingCostGoldAmount: 0,
      adminProfitGold: 0,

      // New workflow tracking fields
      originalOrderWeight: finalJewelryWeight, // Store original target weight
      actualFinalWeight: finalJewelryWeight, // Will be updated as processes complete
      totalWeightLoss: 0, // Will be calculated from processes

      // Stock management - simplified
      useKarigarStock: true, // Always true - karigar stock will be used during processing
      karigarStockDeducted: false, // Will be set to true when stock is deducted during filing
      karigarStockAmount: 0, // Will be set during processing based on actual input weight

      // Process workflow initialization
      processWorkflow: {
        currentProcess: 1, // Start with filing (1)
        totalProcesses: 4, // Standard 4-process workflow: filing, free polish, stone setting, final polish
        processesCompleted: []
      },

      // Size field
      ...(size && { size }),

      // AD Details (new array format)
      ...(adDetails && adDetails.length > 0 && { adDetails }),

      // Delivery date
      ...(deliveryDate && { deliveryDate }),

      // Karat purity
      selectedKarat,

      // Multiple stones support (new format)
      ...(adStones && adStones.length > 0 && { adStones }),
      ...(kalesStones && kalesStones.length > 0 && { kalesStones }),

      // Legacy single stone support (for backward compatibility)
      ...(adStone && {
        adStone: {
          sizeMm: adStone.sizeMm,
          pieces: adStone.pieces,
          totalWeight: adStone.totalWeight
        }
      }),
      ...(kalesStone && {
        kalesStone: {
          sizeMm: kalesStone.sizeMm,
          pieces: kalesStone.pieces,
          totalWeight: kalesStone.totalWeight
        }
      }),

      status: OrderStatus.CREATED,
      createdAt: now,
      updatedAt: now
    }

    const orderResult = await ordersCol.insertOne(orderDoc)
    const orderId = orderResult.insertedId.toString()

    const transactions: GoldTransaction[] = []

    console.log(`Order created:`, {
      orderName,
      finalJewelryWeight,
      selectedKarat
    })

    // Insert any transactions (none in simplified model)
    if (transactions.length > 0) {
      await transactionsCol.insertMany(transactions)
      console.log(`Inserted ${transactions.length} transactions for order ${orderId}`)
    }

    // NOTE: No stock deduction here - that happens during filing process with actual input weight

    const createdOrder = await ordersCol.findOne({ _id: orderResult.insertedId })

    return NextResponse.json({
      order: {
        ...toClientFormat(createdOrder!),
        customer: toClientFormat(customer)
      },
      transactions: transactions.map(t => ({ ...t, id: 'pending' })),
      advanceGoldProcessed: false,
      advanceGoldAmount: 0
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
