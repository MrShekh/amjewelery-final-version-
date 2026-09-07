import { NextRequest } from 'next/server'
import { getInventoryCollection, getUsersCollection, getOrdersCollection, getDb } from '@/lib/mongodb'
import { toClientFormat, AdminGoldStock } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { calculateAdminFineTotal } from '@/lib/admin-stock-karats'
import {
  calculateKarigarLossByKarat,
  calculateNetFineKarigarLoss,
  calculateNetRawKarigarLoss,
  calculateFinishedGoodsByKarat,
  calculateRawFinishedGoods,
  calculateFineFinishedGoods
} from '@/lib/karigar-loss'
import {
  handleApiError,
  handleApiSuccess,
  AuthenticationError,
  ValidationError,
  generateRequestId
} from '@/lib/errorHandler'

// GET /api/inventory - Simplified: only expose karigar loss stock + customer stock for dashboard
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
      payload = verifyToken(token as string)
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

    // Verify email matches token
    if (user.email !== payload.email) {
      throw new AuthenticationError('Token validation failed')
    }

    const userId = user._id.toString()
    const organizationId = user.organizationId

    const inventoryCol = await getInventoryCollection()

    // Find inventory for this specific user/organization
    let inventory = await inventoryCol.findOne({
      $or: [
        { userId: userId },
        { organizationId: organizationId },
        { _id: new ObjectId(userId) } // Fallback for existing data
      ]
    })

    if (!inventory) {
      // Create initial inventory for this user if doesn't exist
      const now = new Date()
      const initialInventory = {
        userId: userId,
        organizationId: organizationId,
        adminStock: 0, // Legacy field, not shown in UI
        karigarStock: 0, // Legacy field, no longer used for working stock
        karigarLossStock: 0, // Total karigar loss bucket
        customerStock: 0, // Starting with 0g
        recoveredStock: 0, // Total recovered from karigar loss
        advanceCustomerStock: 0, // Starting with 0g - advance gold from customers
        lastUpdated: now,
        createdAt: now
      }
      const result = await inventoryCol.insertOne(initialInventory)
      inventory = await inventoryCol.findOne({ _id: result.insertedId })

      if (!inventory) {
        throw new Error('Failed to create or retrieve inventory record')
      }
    }

    // Ensure all stock fields exist for older inventory records (migration/minimum defaults)
    if (inventory) {
      const updates: Record<string, any> = {}

      // Legacy field migration for core stocks
      if (inventory.adminStock === undefined) {
        // If old goldStock exists, use it as adminStock, otherwise default to 0
        updates.adminStock = inventory.goldStock || 0
      }
      if (inventory.customerStock === undefined) {
        // If old jamaGold exists, use it as customerStock, otherwise default to 0
        updates.customerStock = inventory.jamaGold || 0
      }

      // Initialize karigarLossStock, recoveredStock and advanceCustomerStock if missing
      if (inventory.karigarLossStock === undefined) updates.karigarLossStock = 0
      if (inventory.recoveredStock === undefined) updates.recoveredStock = 0
      if (inventory.advanceCustomerStock === undefined) updates.advanceCustomerStock = 0

      if (Object.keys(updates).length > 0) {
        updates.lastUpdated = new Date()
        await inventoryCol.updateOne(
          { _id: inventory._id },
          { $set: updates }
        )
        // Get the updated inventory record with the correct ID
        inventory = await inventoryCol.findOne({ _id: inventory._id })

        if (!inventory) {
          throw new Error('Failed to retrieve updated inventory record')
        }
      }
    }

    // Final null check before returning (should never happen due to earlier checks)
    if (!inventory) {
      throw new Error('Inventory is unexpectedly null')
    }

    // Gold given to a karigar (fillingIn) moves through several buckets over an order's life, and
    // Total Stock must always add up to the same conserved total no matter which stage it's in:
    //  - Still in process (not COMPLETED/DELIVERED): the fillingIn-finishWeight gap is gold that is
    //    simply sitting with the karigar right now - it hasn't been lost, it's just not back yet.
    //    This is what makes Admin Stock go down when you add a Filling In entry - the same amount
    //    shows up here instead, so Total Stock doesn't move (it only relocated, admin -> karigar).
    //  - COMPLETED but not yet DELIVERED (billed): Finish Weight is now final. The shortfall
    //    (fillingIn - finishWeight) is realized Karigar Loss. The finishWeight itself is a real,
    //    finished piece sitting in the shop, not yet billed - tracked as "Finished Goods (Awaiting
    //    Bill)" so it isn't silently missing from Total Stock while it waits to be invoiced.
    //  - DELIVERED (billed): Finished Goods drops out - its fine value has moved into Customer Stock
    //    (plus making charge/profit, which is new value, not gold re-appearing) via the bill route.
    //    The Karigar Loss shortfall stays booked (drives "Clear Total Loss").
    const ordersCol = await getOrdersCollection()
    const allOrders = await ordersCol.find({}, { projection: { fillingIn: 1, finishWeight: 1, selectedKarat: 1, status: 1 } }).toArray()
    const isFinalized = (o: any) => o.status === 'COMPLETED' || o.status === 'DELIVERED'
    const inProcessOrders = allOrders.filter((o: any) => !isFinalized(o))
    const finalizedOrders = allOrders.filter(isFinalized)
    const completedNotBilledOrders = allOrders.filter((o: any) => o.status === 'COMPLETED')

    // Raw (karat-mixed) figures for display cards
    let calculatedKarigarInProcessStock = 0
    inProcessOrders.forEach((o: any) => {
      const fIn = o.fillingIn || 0
      const fWeight = o.finishWeight || 0
      calculatedKarigarInProcessStock += Math.max(0, fIn - fWeight)
    })
    const karigarInProcessStock = parseFloat(Math.max(0, calculatedKarigarInProcessStock).toFixed(3))

    const recoveredStock = inventory.recoveredStock || 0

    // Fine-gold, per-karat versions (correct per-karat conversion, same source as Analytics) - used for Total Stock.
    const karigarInProcessByKarat = calculateKarigarLossByKarat(inProcessOrders as any)
    const karigarInProcessStockFine = Math.max(0, calculateNetFineKarigarLoss(karigarInProcessByKarat, {}))

    // Net of whatever has already been "recovered" (cleared) per karat - see clear-karigar-loss route.
    // Netting is done PER KARAT (clamped at 0 each) before combining, so a karat that was over-cleared
    // in the past (e.g. its orders were later deleted) can't cancel out genuine new loss in another karat.
    const karigarLossByKarat = calculateKarigarLossByKarat(finalizedOrders as any)
    const clearedByKarat = inventory.karigarLossClearedByKarat || {}
    const karigarLossStock = calculateNetRawKarigarLoss(karigarLossByKarat, clearedByKarat)
    const karigarLossStockFine = calculateNetFineKarigarLoss(karigarLossByKarat, clearedByKarat)

    // Finished Goods (Awaiting Bill): Finish Weight itself, for COMPLETED-but-not-yet-DELIVERED orders
    const finishedGoodsByKarat = calculateFinishedGoodsByKarat(completedNotBilledOrders as any)
    const finishedGoodsAwaitingBillStock = calculateRawFinishedGoods(finishedGoodsByKarat)
    const finishedGoodsAwaitingBillStockFine = calculateFineFinishedGoods(finishedGoodsByKarat)

    // Admin Stock: karat-wise ledger converted to fine gold
    const db = await getDb()
    const adminStockDoc = await db.collection<AdminGoldStock>('adminGoldStock').findOne({})
    const adminStockFine = adminStockDoc ? calculateAdminFineTotal(adminStockDoc as any) : 0

    // Total Stock = Admin (fine) + Karigar In-Process (fine) + Finished Goods Awaiting Bill (fine)
    //             + Karigar Loss (fine) + Customer Stock
    const totalStock = parseFloat(
      (
        adminStockFine +
        (inventory.customerStock || 0) +
        karigarInProcessStockFine +
        finishedGoodsAwaitingBillStockFine +
        karigarLossStockFine
      ).toFixed(3)
    )

    // Return only what dashboard needs: inventory snapshot + simple summary
    return handleApiSuccess({
      inventory: toClientFormat({
        _id: inventory._id,
        customerStock: inventory.customerStock,
        karigarInProcessStock,
        karigarInProcessStockFine,
        finishedGoodsAwaitingBillStock,
        finishedGoodsAwaitingBillStockFine,
        karigarLossStock,
        recoveredStock,
        adminStockFine,
        karigarLossStockFine,
        totalStock
      } as any),
      recentTransactions: [],
      summary: {
        customerStock: inventory.customerStock,
        karigarInProcessStock,
        karigarInProcessStockFine,
        finishedGoodsAwaitingBillStock,
        finishedGoodsAwaitingBillStockFine,
        karigarLossStock,
        recoveredStock,
        adminStockFine,
        karigarLossStockFine,
        totalStock
      }
    }, requestId)
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown inventory error'), requestId)
  }
}

// POST /api/inventory - Disabled: manual stock adjustment removed in simplified model
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    // Endpoint disabled in simplified stock model: no manual inventory adjustments.
    return handleApiError(
      new ValidationError('Manual inventory adjustments are disabled in the simplified stock model.'),
      requestId
    )
  } catch (error) {
    return handleApiError(
      error instanceof Error ? error : new Error('Unknown adjustment error'),
      requestId
    )
  }
}
