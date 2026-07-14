import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getCustomersCollection, getGoldTransactionsCollection, getInventoryCollection, getCustomerJamaBalancesCollection, getUsersCollection, getBillsCollection } from '@/lib/mongodb'
import { TransactionType, OrderStatus, toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import {
  handleApiError,
  handleApiSuccess,
  AuthenticationError,
  generateRequestId
} from '@/lib/errorHandler'

// POST /api/orders/[id]/bill - Create bill for completed order
// This processes orders from karigar return stock to customer billing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId()

  try {
    console.log(`[${requestId}] Starting POST /api/orders/[id]/bill request`)

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

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      manufacturingCostGrams,
      includeStones = true,
      manualStoneWeight = 0,
      manualAdWeight = 0,
      advanceGoldUsed = 0,
      notes = '',
      billingWeightOption = 'PURE_GOLD_ONLY', // NEW: PURE_GOLD_ONLY or INCLUDE_STONE_WEIGHT
      makingCharge = 0, // NEW: Making charge to be added to karat purity
      rupees = 0, // NEW: Rupees amount
      manualMakingChargeGrams = 0, // NEW: Manual making charge in grams (for daily stock only)
      previewHTML = '', // NEW: Save the generated preview HTML
      netWeight // ADDED: netWeight manually entered by admin
    } = body

    // Validate required fields
    if (typeof manufacturingCostGrams !== 'number' || manufacturingCostGrams < 0) {
      return NextResponse.json(
        { error: 'Valid manufacturing cost in grams is required' },
        { status: 400 }
      )
    }

    if (typeof advanceGoldUsed !== 'number' || advanceGoldUsed < 0) {
      return NextResponse.json(
        { error: 'Valid advance gold amount is required' },
        { status: 400 }
      )
    }

    if (typeof manualMakingChargeGrams !== 'number' || manualMakingChargeGrams < 0) {
      return NextResponse.json(
        { error: 'Valid manual making charge in grams is required' },
        { status: 400 }
      )
    }

    const ordersCol = await getOrdersCollection()
    const customersCol = await getCustomersCollection()
    const transactionsCol = await getGoldTransactionsCollection()
    const inventoryCol = await getInventoryCollection()
    const customerJamaCol = await getCustomerJamaBalancesCollection()
    const billsCol = await getBillsCollection()

    // Get the order
    const order = await ordersCol.findOne({ _id: new ObjectId(id) })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status !== OrderStatus.COMPLETED) {
      return NextResponse.json(
        { error: 'Order must be completed before creating bill' },
        { status: 400 }
      )
    }

    if (order.status === OrderStatus.DELIVERED) {
      return NextResponse.json(
        { error: 'Order is already billed and delivered' },
        { status: 400 }
      )
    }

    // Get customer
    const customer = await customersCol.findOne({ _id: new ObjectId(order.customerId) })
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }


    // Get current inventory (used only for advance/customer stock in simplified model)
    const inventory = await inventoryCol.findOne({})
    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory not found' },
        { status: 500 }
      )
    }

    // Safely read inventory numeric fields with defaults
    const advanceCustomerStock = typeof inventory.advanceCustomerStock === 'number' ? inventory.advanceCustomerStock : 0
    const customerStock = typeof inventory.customerStock === 'number' ? inventory.customerStock : 0

    // Calculate billing amounts
    const actualGoldWeight = typeof netWeight === 'number' ? netWeight : (order.actualGoldWeight || 0)
    const originalTotalStoneWeight = order.totalStoneWeight || 0
    const actualFinalWeight = actualGoldWeight + originalTotalStoneWeight
    const selectedKarat = order.selectedKarat || 92
    const karatPurity = (selectedKarat + makingCharge) / 100 // Add making charge to karat purity (admin's business logic)

    // Use manual stone weights when provided (custom adjustments)
    const totalCustomStoneWeight = manualStoneWeight + manualAdWeight

    // Note: We need to calculate the stock deduction after billing weight is determined
    // This will be calculated later based on the billing weight chosen

    // Calculate billing weight based on flexible weight selection system
    let baseWeightSelected = 0
    let finalBillingWeight = 0
    let billingWeightInFineGold = 0
    let stoneWeightFromAdminStock = 0 // Track stones admin needs to provide

    if (billingWeightOption === 'PURE_GOLD_ONLY') {
      // Option 1: Bill based on pure gold weight only
      baseWeightSelected = actualGoldWeight // Use the manual netWeight!
      finalBillingWeight = baseWeightSelected + totalCustomStoneWeight // Apply custom adjustments
      billingWeightInFineGold = finalBillingWeight * karatPurity // Convert final weight to fine gold with enhanced purity

      console.log(`🔧 [BILLING DEBUG] Pure gold billing: Base ${baseWeightSelected}g + Custom ${totalCustomStoneWeight}g = Final ${finalBillingWeight}g → Fine gold (${(karatPurity * 100).toFixed(1)}% purity) = ${billingWeightInFineGold.toFixed(3)}g`)
    } else {
      // Option 2: Bill based on final weight (includes original stones)
      baseWeightSelected = actualFinalWeight // Total final weight (with original stones)
      finalBillingWeight = baseWeightSelected + totalCustomStoneWeight // Apply custom adjustments  
      billingWeightInFineGold = finalBillingWeight * karatPurity // Convert final weight to fine gold with enhanced purity

      console.log(`🔧 [BILLING DEBUG] Gold+Stone billing: Base ${baseWeightSelected}g + Custom ${totalCustomStoneWeight}g = Final ${finalBillingWeight}g → Fine gold (${(karatPurity * 100).toFixed(1)}% purity) = ${billingWeightInFineGold.toFixed(3)}g`)

      // Track stone weight difference from original
      const stoneWeightDifference = totalCustomStoneWeight

      if (Math.abs(stoneWeightDifference) > 0.001) { // More than 1mg difference
        console.log(`🔧 [BILLING DEBUG] Custom stone adjustment: ${stoneWeightDifference >= 0 ? '+' : ''}${stoneWeightDifference.toFixed(3)}g (${Math.abs(stoneWeightDifference * 1000).toFixed(0)}mg)`)
      }
    }

    // Legacy variable for backward compatibility
    const billingWeight = finalBillingWeight

    // IMPORTANT: Stock deduction should match what's actually in karigar return stock
    // The making charge is ADDED TO CUSTOMER BILL, not affecting stock deduction

    const originalKaratPurity = selectedKarat / 100

    // Calculate what should be deducted from karigar return stock
    // This should be the actual fine gold that was produced and stored during order completion
    let stockDeductionWeight = 0

    if (billingWeightOption === 'PURE_GOLD_ONLY') {
      // For pure gold billing, we deduct the actual gold weight from stock
      stockDeductionWeight = actualGoldWeight
    } else {
      // For final weight billing, we still only deduct the actual gold weight from stock (not including stones)
      stockDeductionWeight = actualGoldWeight
    }

    // This represents what should be available in karigar return stock (actual production)
    const stockDeductionInFineGold = stockDeductionWeight * originalKaratPurity

    console.log(`🔧 [STOCK LOGIC] Expected in karigar return stock (for reference only): ${stockDeductionInFineGold.toFixed(3)}g fine`)

    // Calculate making charge (use custom override or default from order)
    const makingChargePerGram = makingCharge || order.makingChargePerGram || 1500
    const totalMakingCharge = makingChargePerGram * billingWeightInFineGold

    console.log(`🔧 [BILLING DEBUG] makingChargePerGram: ₹${makingChargePerGram}/g`)
    console.log(`🔧 [BILLING DEBUG] totalMakingCharge: ₹${totalMakingCharge.toFixed(2)} (${billingWeightInFineGold.toFixed(3)}g × ₹${makingChargePerGram}/g)`)

    // Calculate total before advance gold (manufacturing cost always in fine gold)
    const subtotalCustomerOwedFineGold = billingWeightInFineGold + manufacturingCostGrams

    // Apply advance gold settlement
    const totalCustomerOwedFineGold = Math.max(0, subtotalCustomerOwedFineGold - advanceGoldUsed)

    // Debug logging
    console.log(`🔧 [BILLING DEBUG] Order: ${order.orderName}`)
    console.log(`🔧 [BILLING DEBUG] billingWeightOption: ${billingWeightOption}`)
    console.log(`🔧 [BILLING DEBUG] selectedKarat: ${selectedKarat}%`)
    console.log(`🔧 [BILLING DEBUG] makingCharge: ${makingCharge}`)
    console.log(`🔧 [BILLING DEBUG] karatPurity: ${karatPurity} (${selectedKarat}% + ${makingCharge}% = ${(selectedKarat + makingCharge).toFixed(1)}%)`)
    console.log(`🔧 [BILLING DEBUG] actualGoldWeight: ${actualGoldWeight}g`)
    console.log(`🔧 [BILLING DEBUG] stockDeductionWeight: ${stockDeductionWeight}g`)
    console.log(`🔧 [BILLING DEBUG] originalKaratPurity: ${originalKaratPurity} (${selectedKarat}%)`)
    console.log(`🔧 [BILLING DEBUG] stockDeductionInFineGold: ${stockDeductionInFineGold}g (what's actually in karigar return stock)`)
    console.log(`🔧 [BILLING DEBUG] CUSTOMER BILL: ${billingWeightInFineGold.toFixed(3)}g (includes ${makingCharge}% making charge)`)
    console.log(`🔧 [BILLING DEBUG] STOCK DEDUCTION: ${stockDeductionInFineGold.toFixed(3)}g (actual production, no making charge)`)
    console.log(`🔧 [BILLING DEBUG] totalCustomStoneWeight: ${totalCustomStoneWeight}g`)
    console.log(`🔧 [BILLING DEBUG] stoneWeightFromAdminStock: ${stoneWeightFromAdminStock}g`)
    console.log(`🔧 [BILLING DEBUG] billingWeight: ${billingWeight}g (total weight for customer)`)
    console.log(`🔧 [BILLING DEBUG] billingWeightInFineGold: ${billingWeightInFineGold}g (fine gold only)`)
    console.log(`🔧 [BILLING DEBUG] manufacturingCostGrams: ${manufacturingCostGrams}g`)
    console.log(`🔧 [BILLING DEBUG] subtotalCustomerOwedFineGold: ${subtotalCustomerOwedFineGold}g`)
    console.log(`🔧 [BILLING DEBUG] advanceGoldUsed: ${advanceGoldUsed}g`)
    console.log(`🔧 [BILLING DEBUG] totalCustomerOwedFineGold: ${totalCustomerOwedFineGold}g`)
    console.log(`🔧 [BILLING DEBUG] Current customerStock: ${inventory.customerStock}g`)

    // Check if sufficient advance gold is available when advance gold is used
    if (advanceGoldUsed > 0 && advanceCustomerStock < advanceGoldUsed) {
      return NextResponse.json(
        { error: `Insufficient advance gold stock. Available: ${advanceCustomerStock.toFixed(3)}g, Required: ${advanceGoldUsed.toFixed(3)}g` },
        { status: 400 }
      )
    }

    const now = new Date()

    // Update order with billing information
    await ordersCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: OrderStatus.DELIVERED,
          actualGoldWeight,
          actualFinalWeight,
          manufacturingCostGrams,
          makingCharge: manualMakingChargeGrams, // Store the manual making charge in grams automatically!
          rupees, // Store the rupees amount
          totalCustomerOwedFineGold,
          billingWeight,
          billingWeightInFineGold,
          billingWeightOption,
          manualStoneWeight,
          manualAdWeight,
          totalCustomStoneWeight,
          baseWeightSelected,
          finalBillingWeight,
          makingChargePerGram,
          totalMakingCharge,
          billingNotes: notes,
          billedAt: now,
          updatedAt: now
        }
      }
    )

    // Update inventory based on advance gold usage and customer owed gold (simplified model)
    const inventoryUpdate: any = {
      $inc: {},
      $set: { lastUpdated: now }
    }

    // Handle stone weight deduction from admin stock if needed
    if (billingWeightOption === 'INCLUDE_STONE_WEIGHT' && stoneWeightFromAdminStock > 0) {
      // Admin provides stones from admin stock (conceptually - you may have separate stone inventory)
      // For now, we'll track this in the notes and transactions
      console.log(`🔧 [BILLING DEBUG] Admin needs to provide ${stoneWeightFromAdminStock}g worth of stones`)
    }

    if (advanceGoldUsed > 0) {
      // Transfer advance gold to admin stock (advance gold settlement)
      inventoryUpdate.$inc.advanceCustomerStock = (inventoryUpdate.$inc.advanceCustomerStock || 0) - advanceGoldUsed  // Remove from advance stock
      inventoryUpdate.$inc.adminStock = (inventoryUpdate.$inc.adminStock || 0) + advanceGoldUsed  // Transfer advance to admin stock
    }

    // Add owed gold to customer stock
    if (totalCustomerOwedFineGold > 0) {
      inventoryUpdate.$inc.customerStock = (inventoryUpdate.$inc.customerStock || 0) + totalCustomerOwedFineGold
    }

    // If there are no $inc operations, remove the key to avoid invalid update
    if (Object.keys(inventoryUpdate.$inc).length === 0) {
      delete inventoryUpdate.$inc
    }

    console.log(`[BILL DEBUG] Inventory update:`, inventoryUpdate)
    console.log(`[BILL DEBUG] Customer addition: ${totalCustomerOwedFineGold.toFixed(3)}g to customer stock`)

    await inventoryCol.updateOne(
      { _id: inventory._id },
      inventoryUpdate
    )

    // Check final inventory state
    const updatedInventory = await inventoryCol.findOne({ _id: inventory._id })
    console.log(`[BILL DEBUG] Updated customerStock: ${updatedInventory?.customerStock}g`)

    // Create order-specific jama balance entry (they owe this gold)
    if (totalCustomerOwedFineGold > 0) {
      await customerJamaCol.insertOne({
        customerId: order.customerId,
        orderId: id, // Link to the specific order
        goldBalance: totalCustomerOwedFineGold,
        jamaGoldAmount: totalCustomerOwedFineGold,
        returnedAmount: 0,
        pendingAmount: totalCustomerOwedFineGold,
        notes: `Order "${order.orderName}" billing - Customer owes ${totalCustomerOwedFineGold.toFixed(3)}g fine gold${advanceGoldUsed > 0 ? ' (after advance gold settlement)' : ''}`,
        createdAt: now,
        updatedAt: now
      })
    }

    // Create transactions array
    const transactions = []

    // Create advance gold settlement transaction if advance gold was used
    if (advanceGoldUsed > 0) {
      const advanceTransaction = {
        orderId: id,
        customerId: order.customerId,
        type: TransactionType.GOLD_OUT,
        amount: advanceGoldUsed,
        description: `Advance gold settlement for order ${order.orderName}. Transferred ${advanceGoldUsed.toFixed(3)}g from Advance Stock to Admin Stock`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      transactions.push(advanceTransaction)
    }

    // Create billing transaction for remaining amount (if any)
    if (totalCustomerOwedFineGold > 0) {
      const billingTransaction = {
        orderId: id,
        customerId: order.customerId,
        type: TransactionType.JAMA_GOLD_ADDED,
        amount: totalCustomerOwedFineGold,
        description: `Bill created for order ${order.orderName}. ${billingWeightOption === 'PURE_GOLD_ONLY'
          ? `Pure gold billing: ${stockDeductionInFineGold.toFixed(3)}g fine from stock`
          : `Gold+Stone billing: ${stockDeductionInFineGold.toFixed(3)}g fine gold from stock + ${stoneWeightFromAdminStock.toFixed(3)}g admin stones`
          } + Making: ${manufacturingCostGrams.toFixed(3)}g fine${advanceGoldUsed > 0 ? ` - Advance: ${advanceGoldUsed.toFixed(3)}g fine` : ''} = Customer owes: ${totalCustomerOwedFineGold.toFixed(3)}g fine gold`,
        recoveredGold: 0,
        createdAt: now,
        updatedAt: now
      }
      transactions.push(billingTransaction)
    }

    // Insert all transactions
    const insertedTransactions = []
    for (const transaction of transactions) {
      const txResult = await transactionsCol.insertOne(transaction)
      const newTx = await transactionsCol.findOne({ _id: txResult.insertedId })
      insertedTransactions.push(toClientFormat(newTx!))
    }

    // Fetch customer's past jama balances (excluding current order)
    const jamaBalances = await customerJamaCol.find({ customerId: order.customerId }).toArray()
    const pastPendingDetails = jamaBalances
      .filter((balance) => balance.orderId !== id) // Exclude current order
      .map((balance) => ({
        orderId: balance.orderId || 'past',
        orderInfo: balance.notes ? { orderName: balance.notes } : undefined,
        pendingAmount: (balance.goldBalance || balance.jamaGoldAmount || 0) - (balance.returnedAmount || 0)
      }))
      .filter((detail) => detail.pendingAmount > 0)

    const totalPastPendingAmount = pastPendingDetails.reduce((sum, detail) => sum + detail.pendingAmount, 0)

    // Generate bill number first
    const billNumber = `ORD-${order.orderNumber || id.slice(-6)}-${Date.now().toString().slice(-6)}`

    // Create complete bill record for storage
    const billData = {
      userId: user._id.toString(),
      pastPendingAmounts: totalPastPendingAmount > 0 ? {
        totalAmount: totalPastPendingAmount,
        details: pastPendingDetails
      } : undefined,
      organizationId: user.organizationId,
      orderId: id,
      customerId: order.customerId,
      billNumber: billNumber,
      orderDetails: {
        id: order._id.toString(),
        orderName: order.orderName,
        orderPhoto: order.orderPhoto,
        orderNumber: order.orderNumber,
        status: OrderStatus.DELIVERED,
        createdAt: order.createdAt,
        finalJewelryWeight: order.finalJewelryWeight,
        actualFinalWeight: order.actualFinalWeight,
        actualGoldWeight: order.actualGoldWeight,
        totalStoneWeight: order.totalStoneWeight,
        selectedKarat: order.selectedKarat,
        customerProvidedGold: order.customerProvidedGold
      },
      customerDetails: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address || ''
      },
      billing: {
        actualGoldWeight,
        stockDeductionInFineGold, // Stock deduction at original purity
        totalStoneWeight: originalTotalStoneWeight,
        manufacturingCostGrams,
        subtotalCustomerOwedFineGold,
        advanceGoldUsed,
        totalCustomerOwedFineGold,
        billingWeight,
        billingWeightInFineGold,
        includeStones,
        billingWeightOption, // NEW: Track billing option used
        stoneWeightFromAdminStock, // NEW: Track stones admin provided
        manualStoneWeight, // NEW: Manual stone weight adjustment
        manualAdWeight, // NEW: Manual ad weight adjustment
        totalCustomStoneWeight, // NEW: Total custom stone weight
        baseWeightSelected, // NEW: Base weight selected by admin
        finalBillingWeight, // NEW: Final billing weight after adjustments
        makingCharge, // NEW: Making charge override
        makingChargePerGram, // NEW: Resolved making charge per gram
        totalMakingCharge, // NEW: Total making charge amount
        rupees, // NEW: Rupees amount
        manualMakingChargeGrams, // NEW: Manual making charge in grams (for daily stock only)
        notes
      },
      processes: order.processes || [],
      transactions: insertedTransactions,
      previewHTML: previewHTML.replace(/PREVIEW/g, billNumber), // Replace PREVIEW with actual bill number
      status: 'CREATED',
      createdAt: now,
      updatedAt: now,
      createdBy: {
        id: user._id.toString(),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      }
    }

    // Save bill to database
    const savedBillResult = await billsCol.insertOne(billData)
    const savedBill = await billsCol.findOne({ _id: savedBillResult.insertedId })

    // Get updated order with all data
    const updatedOrder = await ordersCol.findOne({ _id: new ObjectId(id) })

    console.log(`[${requestId}] Bill created successfully for order ${id}`)

    return NextResponse.json({
      message: 'Bill created successfully',
      order: toClientFormat(updatedOrder!),
      transactions: insertedTransactions,
      bill: toClientFormat(savedBill!),
      billingSummary: {
        actualGoldWeight,
        stockDeductionInFineGold, // Stock deduction at original purity
        originalTotalStoneWeight,
        manualStoneWeight,
        manualAdWeight,
        totalCustomStoneWeight,
        manufacturingCostGrams,
        subtotalCustomerOwedFineGold,
        advanceGoldUsed,
        totalCustomerOwedFineGold,
        billingWeight,
        billingWeightInFineGold,
        includeStones,
        billingWeightOption,
        baseWeightSelected,
        finalBillingWeight,
        stoneWeightFromAdminStock,
        makingCharge,
        makingChargePerGram,
        totalMakingCharge,
        rupees,
        manualMakingChargeGrams,
        karigarReturnStockUsed: stockDeductionInFineGold, // Stock deduction at original purity
        advanceGoldSettled: advanceGoldUsed,
        customerBalance: totalCustomerOwedFineGold
      }
    })
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error('Unknown billing error'), requestId)
  }
}
