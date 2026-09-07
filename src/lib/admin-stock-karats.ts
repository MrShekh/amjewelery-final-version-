// Admin Gold Stock — karat-wise ledger helpers
// Mirrors the karat list already used across the app (gold-conversions.ts / orders)
import { karatToFine, KaratPurity, KARAT_PURITY_VALUES } from './gold-conversions'

export const ADMIN_STOCK_KARATS: KaratPurity[] = KARAT_PURITY_VALUES

// Mongo field names can't contain '.', so 75.5 -> 'k75_5', 37.5 -> 'k37_5', 92 -> 'k92', etc.
export function karatFieldKey(karat: number): string {
  return 'k' + karat.toString().replace('.', '_')
}

export type AdminKaratStocks = Partial<Record<string, number>>

export function calculateAdminFineTotal(stocks: AdminKaratStocks): number {
  let total = 0
  for (const karat of ADMIN_STOCK_KARATS) {
    const weight = stocks[karatFieldKey(karat)] || 0
    total += karatToFine(weight, karat)
  }
  total += stocks.fineStock || 0 // Fine gold credited directly (e.g. recovered from a customer), not tied to a karat
  return Math.round(total * 1000) / 1000
}

export function getAdminKaratBreakdown(stocks: AdminKaratStocks) {
  return ADMIN_STOCK_KARATS.map(karat => {
    const weight = stocks[karatFieldKey(karat)] || 0
    return {
      karat,
      weight,
      fine: karatToFine(weight, karat)
    }
  })
}
