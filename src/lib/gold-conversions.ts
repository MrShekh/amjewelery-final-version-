// Gold Purity Conversion Utilities for Casting Process

// Standard purity percentages for different karat gold
export const KARAT_PURITIES = [92, 88, 84, 80, 76, 75.5, 75, 59, 37.5] as const

export type KaratPurity = typeof KARAT_PURITIES[number]

// Helper to get array of purities for iteration
export const KARAT_PURITY_VALUES: KaratPurity[] = [92, 88, 84, 80, 76, 75.5, 75, 59, 37.5]

// Convert Fine Gold to Karat Gold for casting
// Formula: Karat Gold = Fine Gold ÷ (Purity / 100)
// Example: 100g Fine ÷ 0.92 = 108.70g (22k Gold)
export function fineToKarat(fineGoldWeight: number, purity: KaratPurity): number {
  const karatWeight = fineGoldWeight / (purity / 100)
  return Math.round(karatWeight * 1000) / 1000 // Round to 3 decimal places
}

// Convert Karat Gold back to Fine Gold
// Formula: Fine Gold = Karat Gold × (Purity / 100)
// Example: 70g (22k) × 0.92 = 64.4g Fine Gold
export function karatToFine(karatGoldWeight: number, purity: KaratPurity): number {
  const fineWeight = karatGoldWeight * (purity / 100)
  return Math.round(fineWeight * 1000) / 1000 // Round to 3 decimal places
}

// Calculate total fine gold from all karigar karat stocks
export interface KarigarKaratStocks {
  karigar92: number   // 22k gold (92% purity)
  karigar88: number   // 21.1k gold (88% purity)
  karigar84: number   // 20k gold (84% purity)
  karigar80: number   // 19.2k gold (80% purity)
  karigar76: number   // 18.2k gold (76% purity)
  karigar755: number  // 18k gold (75.5% purity) 
  karigar75: number   // 18k gold (75% purity)
  karigar59: number   // 14.2k gold (59% purity)
  karigar375: number  // 9k gold (37.5% purity)
}

export function calculateKarigarFineGoldFromKarat(karatStocks: KarigarKaratStocks): number {
  const fine92 = karatToFine(karatStocks.karigar92, 92)
  const fine88 = karatToFine(karatStocks.karigar88, 88)
  const fine84 = karatToFine(karatStocks.karigar84, 84)
  const fine80 = karatToFine(karatStocks.karigar80, 80)
  const fine76 = karatToFine(karatStocks.karigar76, 76)
  const fine755 = karatToFine(karatStocks.karigar755, 75.5)
  const fine75 = karatToFine(karatStocks.karigar75, 75)
  const fine59 = karatToFine(karatStocks.karigar59, 59)
  const fine375 = karatToFine(karatStocks.karigar375, 37.5)
  
  return Math.round((fine92 + fine88 + fine84 + fine80 + fine76 + fine755 + fine75 + fine59 + fine375) * 1000) / 1000
}

// Casting process calculation
export interface CastingCalculation {
  fineGoldTaken: number
  selectedPurity: KaratPurity
  maxKaratGoldPossible: number
  actualKaratGoldCast: number
  remainingKaratGold: number
  fineGoldReturnedToAdmin: number
}

export function calculateCastingProcess(
  fineGoldTaken: number, 
  selectedPurity: KaratPurity, 
  actualCastingDone: number
): CastingCalculation {
  
  // Convert fine gold to maximum karat gold possible
  const maxKaratGoldPossible = fineToKarat(fineGoldTaken, selectedPurity)
  
  // Calculate remaining karat gold after casting
  const remainingKaratGold = maxKaratGoldPossible - actualCastingDone
  
  // Convert remaining karat gold back to fine gold
  const fineGoldReturnedToAdmin = karatToFine(remainingKaratGold, selectedPurity)
  
  return {
    fineGoldTaken,
    selectedPurity,
    maxKaratGoldPossible,
    actualKaratGoldCast: actualCastingDone,
    remainingKaratGold,
    fineGoldReturnedToAdmin
  }
}

// Helper function to format gold weight with proper precision
export function formatGoldWeight(weight: number): string {
  return weight.toFixed(3) + 'g'
}

// Get purity name for display
export function getPurityDisplayName(purity: KaratPurity): string {
  switch (purity) {
    case 92: return '22k (92%)'
    case 88: return '21.1k (88%)'
    case 84: return '20k (84%)'
    case 80: return '19.2k (80%)'
    case 76: return '18.2k (76%)'
    case 75.5: return '18k (75.5%)'
    case 75: return '18k (75%)'
    case 59: return '14.2k (59%)'
    case 37.5: return '9k (37.5%)'
    default: return `${purity}%`
  }
}
