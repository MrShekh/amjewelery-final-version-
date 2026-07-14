export interface GoldCalculationResult {
  initialStock: number
  goldUsedFromStock: number
  totalGoldLoss: number
  totalRecoveredGold: number
  manufacturingCostGold: number
  adminProfitGold: number
  finalStock: number
}

export interface OrderCalculation {
  customerGold: number
  adminGold: number
  totalGoldUsed: number
  goldLossPerProcess: { karigarId: string; processType: string; loss: number }[]
  recoveredGold: number
  manufacturingCostGold: number
  adminProfit: number
}

/**
 * Calculate gold stock changes for an order
 * Based on your business logic:
 * 1. Customer gives gold + admin adds from stock = total gold for manufacturing
 * 2. Gold goes through manufacturing processes with losses
 * 3. Final jewelry is delivered to customer
 * 4. Manufacturing cost is paid (part of which is admin's profit)
 * 5. Some gold is recovered from losses
 * 6. Admin's stock is updated accordingly
 */
export function calculateGoldStockChanges(
  initialStock: number,
  orderData: OrderCalculation
): GoldCalculationResult {
  const {
    adminGold,
    goldLossPerProcess,
    recoveredGold,
    manufacturingCostGold,
    adminProfit
  } = orderData

  // Calculate total gold loss across all processes
  const totalGoldLoss = goldLossPerProcess.reduce((sum, process) => sum + process.loss, 0)

  // Admin's gold used from stock (negative impact on stock)
  const goldUsedFromStock = adminGold

  // Gold recovered adds back to stock
  const stockAfterRecovery = initialStock - goldUsedFromStock + recoveredGold

  // Admin's profit from manufacturing cost (positive impact on stock)
  const finalStock = stockAfterRecovery + adminProfit

  return {
    initialStock,
    goldUsedFromStock,
    totalGoldLoss,
    totalRecoveredGold: recoveredGold,
    manufacturingCostGold,
    adminProfitGold: adminProfit,
    finalStock
  }
}

/**
 * Calculate manufacturing requirements
 * For jewelry making, typically need extra gold beyond the final weight
 */
export function calculateManufacturingRequirements(
  finalJewelryWeight: number,
  extraGoldPercentage: number = 20 // 20% extra gold typically needed
): number {
  return finalJewelryWeight * (1 + extraGoldPercentage / 100)
}

/**
 * Validate order calculations
 */
export function validateOrderCalculations(orderData: OrderCalculation): string[] {
  const errors: string[] = []

  if (orderData.customerGold < 0) {
    errors.push('Customer gold cannot be negative')
  }

  if (orderData.adminGold < 0) {
    errors.push('Admin gold cannot be negative')
  }

  if (orderData.customerGold + orderData.adminGold !== orderData.totalGoldUsed) {
    errors.push('Total gold used must equal customer gold + admin gold')
  }

  if (orderData.recoveredGold < 0) {
    errors.push('Recovered gold cannot be negative')
  }

  const totalLoss = orderData.goldLossPerProcess.reduce((sum, p) => sum + p.loss, 0)
  if (orderData.recoveredGold > totalLoss) {
    errors.push('Recovered gold cannot exceed total gold loss')
  }

  return errors
}

/**
 * Convert grams to milligrams
 */
export function gramsToMilligrams(grams: number): number {
  return grams * 1000
}

/**
 * Convert milligrams to grams
 */
export function milligramsToGrams(milligrams: number): number {
  return milligrams / 1000
}
