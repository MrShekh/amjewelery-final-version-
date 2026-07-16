import { NextRequest } from 'next/server'
import { getInventoryCollection, getUsersCollection, getOrdersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
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

    // Calculate karigarLossStock dynamically from all orders (fillingIn - finishWeight)
    const ordersCol = await getOrdersCollection()
    const allOrders = await ordersCol.find({}, { projection: { fillingIn: 1, finishWeight: 1 } }).toArray()
    let calculatedKarigarLossStock = 0
    allOrders.forEach((o: any) => {
      const fIn = o.fillingIn || 0
      const fWeight = o.finishWeight || 0
      calculatedKarigarLossStock += Math.max(0, fIn - fWeight)
    })
    const karigarLossClearedAmount = inventory.karigarLossClearedAmount || 0
    const karigarLossStock = parseFloat(Math.max(0, calculatedKarigarLossStock - karigarLossClearedAmount).toFixed(3))
    const recoveredStock = inventory.recoveredStock || 0

    // Return only what dashboard needs: inventory snapshot + simple summary
    return handleApiSuccess({
      inventory: toClientFormat({
        _id: inventory._id,
        customerStock: inventory.customerStock,
        karigarLossStock,
        recoveredStock
      } as any),
      recentTransactions: [],
      summary: {
        customerStock: inventory.customerStock,
        karigarLossStock,
        recoveredStock
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
