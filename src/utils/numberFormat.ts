/**
 * Utility functions for standardized number formatting across the application
 * All floating-point numbers should have exactly 3 decimal places with truncation (no rounding)
 */

/**
 * Truncates a number to exactly 3 decimal places without rounding
 * @param value - The number to truncate
 * @returns Number truncated to 3 decimal places
 * 
 * Examples:
 * - truncateToThreeDecimals(1.935678) => 1.935
 * - truncateToThreeDecimals(1.999999) => 1.999
 * - truncateToThreeDecimals(1.1) => 1.100
 */
export function truncateToThreeDecimals(value: number | string): number {
  if (value === null || value === undefined || value === '') return 0
  
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 0
  
  // Multiply by 1000, truncate using Math.floor, then divide by 1000
  return Math.floor(num * 1000) / 1000
}

/**
 * Formats a number to display exactly 3 decimal places as a string
 * @param value - The number to format
 * @returns String formatted to show exactly 3 decimal places
 * 
 * Examples:
 * - formatToThreeDecimals(1.935) => "1.935"
 * - formatToThreeDecimals(1.1) => "1.100"
 * - formatToThreeDecimals(1) => "1.000"
 */
export function formatToThreeDecimals(value: number | string): string {
  const truncated = truncateToThreeDecimals(value)
  return truncated.toFixed(3)
}

/**
 * Safely parses a string/number input and truncates to 3 decimals
 * Useful for form inputs and API data processing
 * @param value - The value to parse and truncate
 * @returns Number truncated to 3 decimal places
 */
export function parseAndTruncate(value: any): number {
  if (value === null || value === undefined || value === '') return 0
  
  let num: number
  if (typeof value === 'string') {
    // Remove any non-numeric characters except decimal point and negative sign
    const cleaned = value.replace(/[^\d.-]/g, '')
    num = parseFloat(cleaned)
  } else if (typeof value === 'number') {
    num = value
  } else {
    return 0
  }
  
  if (isNaN(num)) return 0
  return truncateToThreeDecimals(num)
}

/**
 * Processes an object to truncate all numeric values to 3 decimals
 * Useful for API responses and database operations
 * @param obj - Object containing numeric values
 * @returns New object with all numbers truncated to 3 decimals
 */
export function truncateObjectNumbers(obj: any): any {
  if (obj === null || obj === undefined) return obj
  
  if (typeof obj === 'number') {
    return truncateToThreeDecimals(obj)
  }
  
  if (typeof obj === 'string') {
    // Don't modify strings that aren't numeric
    const num = parseFloat(obj)
    return isNaN(num) ? obj : formatToThreeDecimals(num)
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => truncateObjectNumbers(item))
  }
  
  if (typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateObjectNumbers(value)
    }
    return result
  }
  
  return obj
}

/**
 * Fields that should be treated as numeric values in the jewelry application
 */
export const NUMERIC_FIELDS = [
  'goldLoss',
  'goldRecovered',
  'karigarMakingCharge',
  'inputWeight',
  'outputWeight',
  'adminRecoverable',
  'totalLoss',
  'totalRecovered',
  'makingCharge',
  'recoveredAmount',
  'actualRecoveryAmount',
  'totalRecoveryAmount',
  'remainingBalance',
  'fineGoldRecovered',
  'adminStock',
  'totalGoldUsed',
  'finalJewelryWeight',
  'manufacturingCost',
  'adminProfitGold',
  'recoveredGold',
  'amount',
  'totalWeight',
  'pieces',
  'karatPurity',
  'bulkMakingCharge',
  'totalInput',
  'totalOutput',
  'netLoss',
  'availableToRecover'
] as const

/**
 * Specifically truncates jewelry-related numeric fields in an object
 * @param obj - Object that may contain jewelry numeric fields
 * @returns Object with numeric fields truncated to 3 decimals
 */
export function truncateJewelryNumbers(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  
  const result = { ...obj }
  
  for (const field of NUMERIC_FIELDS) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = truncateToThreeDecimals(result[field])
    }
  }
  
  return result
}
