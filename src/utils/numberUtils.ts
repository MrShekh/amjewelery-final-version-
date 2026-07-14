/**
 * Utility functions for safe number handling and NaN protection
 */

/**
 * Safely converts a value to a number, returning 0 if the value is NaN, null, undefined, or invalid
 * @param value - The value to convert to a number
 * @returns A safe number (0 if input is invalid)
 */
export function safeNumber(value: any): number {
  if (value === null || value === undefined) {
    return 0
  }
  
  const num = parseFloat(String(value))
  return isNaN(num) ? 0 : num
}

/**
 * Safely formats a number for display, showing '0.000' if the number is NaN
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted number string
 */
export function safeFormatNumber(value: any, decimals: number = 3): string {
  const num = safeNumber(value)
  return num.toFixed(decimals)
}

/**
 * Formats a number preserving its original precision without rounding
 * This is critical for cases like 1.935 and 0.500 where exact values must be preserved
 * @param value - The number to format
 * @param minDecimals - Minimum decimal places to show (default: 3)
 * @param maxDecimals - Maximum decimal places to show (default: 6)
 * @returns Formatted number string with exact precision preserved
 */
export function preservePrecisionFormat(value: any, minDecimals: number = 3, maxDecimals: number = 6): string {
  if (value === null || value === undefined) {
    return '0.' + '0'.repeat(minDecimals)
  }
  
  // Convert to string to preserve original precision
  const str = String(value).trim()
  const num = parseFloat(str)
  
  if (isNaN(num)) {
    return '0.' + '0'.repeat(minDecimals)
  }
  
  // If the original string has decimal places, preserve them
  if (str.includes('.')) {
    const decimalParts = str.split('.')
    const decimalPlaces = decimalParts[1].length
    
    // For string inputs, preserve the exact format if within range
    if (typeof value === 'string' && decimalPlaces >= minDecimals && decimalPlaces <= maxDecimals) {
      // Validate that it's a valid number format and return as-is
      if (/^\d+\.\d+$/.test(str)) {
        return str
      }
    }
    
    // Use the original decimal places if within our range
    if (decimalPlaces >= minDecimals && decimalPlaces <= maxDecimals) {
      return num.toString() // This preserves the original precision
    } else if (decimalPlaces > maxDecimals) {
      return num.toFixed(maxDecimals)
    } else {
      return num.toFixed(minDecimals)
    }
  } else {
    // No decimal places in original, add minimum required
    return num.toFixed(minDecimals)
  }
}

/**
 * Formats a number for display in bills, preserving exact input precision
 * This ensures values like 1.935 show as 1.935 and 0.500 shows as 0.500
 * @param value - The number to format
 * @returns Formatted number string with exact precision
 */
export function formatForBilling(value: any): string {
  return preservePrecisionFormat(value, 3, 6)
}

/**
 * Safely adds two numbers, handling NaN values
 * @param a - First number
 * @param b - Second number
 * @returns Sum of the numbers (0 if either is NaN)
 */
export function safeAdd(a: any, b: any): number {
  return safeNumber(a) + safeNumber(b)
}

/**
 * Safely subtracts two numbers, handling NaN values
 * @param a - First number
 * @param b - Second number
 * @returns Difference of the numbers (0 if either is NaN)
 */
export function safeSubtract(a: any, b: any): number {
  return safeNumber(a) - safeNumber(b)
}

/**
 * Safely multiplies two numbers, handling NaN values
 * @param a - First number
 * @param b - Second number
 * @returns Product of the numbers (0 if either is NaN)
 */
export function safeMultiply(a: any, b: any): number {
  return safeNumber(a) * safeNumber(b)
}

/**
 * Safely divides two numbers, handling NaN values and division by zero
 * @param a - Numerator
 * @param b - Denominator
 * @returns Quotient (0 if denominator is 0 or either value is NaN)
 */
export function safeDivide(a: any, b: any): number {
  const numA = safeNumber(a)
  const numB = safeNumber(b)
  
  if (numB === 0) {
    return 0
  }
  
  return numA / numB
}

/**
 * Safely calculates the sum of an array of values, handling NaN values
 * @param values - Array of values to sum
 * @param accessor - Optional function to access the value from each item
 * @returns Sum of all values (skipping NaN values)
 */
export function safeSum<T>(values: T[], accessor?: (item: T) => any): number {
  return values.reduce((sum, item) => {
    const value = accessor ? accessor(item) : item
    return sum + safeNumber(value)
  }, 0)
}

/**
 * Safely calculates the maximum of two numbers, handling NaN values
 * @param a - First number
 * @param b - Second number
 * @returns Maximum of the two numbers (0 if both are NaN)
 */
export function safeMax(a: any, b: any): number {
  const numA = safeNumber(a)
  const numB = safeNumber(b)
  return Math.max(numA, numB)
}

/**
 * Safely calculates the minimum of two numbers, handling NaN values
 * @param a - First number
 * @param b - Second number
 * @returns Minimum of the two numbers (0 if both are NaN)
 */
export function safeMin(a: any, b: any): number {
  const numA = safeNumber(a)
  const numB = safeNumber(b)
  return Math.min(numA, numB)
}

/**
 * Checks if a value is a valid number (not NaN, null, or undefined)
 * @param value - The value to check
 * @returns True if the value is a valid number
 */
export function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

/**
 * Converts milligrams to grams safely
 * @param milligrams - Weight in milligrams
 * @returns Weight in grams
 */
export function milligramsToGrams(milligrams: any): number {
  return safeDivide(milligrams, 1000)
}

/**
 * Converts grams to milligrams safely
 * @param grams - Weight in grams
 * @returns Weight in milligrams
 */
export function gramsToMilligrams(grams: any): number {
  return safeMultiply(grams, 1000)
}

/**
 * Calculates percentage safely
 * @param value - The value
 * @param total - The total
 * @returns Percentage (0 if total is 0 or either value is NaN)
 */
export function safePercentage(value: any, total: any): number {
  const numValue = safeNumber(value)
  const numTotal = safeNumber(total)
  
  if (numTotal === 0) {
    return 0
  }
  
  return (numValue / numTotal) * 100
}
