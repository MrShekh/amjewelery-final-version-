// Single source of truth for karigar loss in fine gold, per karat.
// This is the exact formula already used by the Analytics page (see the
// karatTotals loop in src/app/api/orders/route.ts) - kept here so Total Stock
// (src/app/api/inventory/route.ts) reads the same number Analytics shows,
// instead of a separately maintained calculation that can drift out of sync.
import { karatFieldKey } from './admin-stock-karats'

export interface KarigarLossOrderInput {
  fillingIn?: number
  finishWeight?: number
  selectedKarat?: number
}

export function calculateFineKarigarLoss(orders: KarigarLossOrderInput[]): number {
  let fineTotal = 0
  orders.forEach(o => {
    const karat = parseFloat(String(o.selectedKarat)) || 92
    const fIn = o.fillingIn || 0
    const fWeight = o.finishWeight || 0
    const loss = parseFloat((fIn - fWeight).toFixed(3)) // signed, matches Analytics (not floored at 0)
    fineTotal += loss * (karat / 100)
  })
  return parseFloat(fineTotal.toFixed(3))
}

export interface KarigarLossByKaratEntry {
  karat: number
  rawLoss: number // signed, karat-gold weight (not fine), matches Analytics per-karat total
}

// Same raw loss as above, but grouped per karat so a recovered amount can be
// credited back into the correct Admin Stock karat bucket.
export function calculateKarigarLossByKarat(orders: KarigarLossOrderInput[]): Record<string, KarigarLossByKaratEntry> {
  const result: Record<string, KarigarLossByKaratEntry> = {}
  orders.forEach(o => {
    const karat = parseFloat(String(o.selectedKarat)) || 92
    const key = karatFieldKey(karat)
    const fIn = o.fillingIn || 0
    const fWeight = o.finishWeight || 0
    const loss = parseFloat((fIn - fWeight).toFixed(3))
    if (!result[key]) result[key] = { karat, rawLoss: 0 }
    result[key].rawLoss += loss
  })
  Object.values(result).forEach(entry => {
    entry.rawLoss = parseFloat(entry.rawLoss.toFixed(3))
  })
  return result
}

// Net fine loss = live per-karat raw loss minus whatever has already been cleared for that karat.
// Each karat's net is clamped at 0 BEFORE summing - otherwise a karat that was over-cleared in the
// past (e.g. its orders got deleted after clearing) goes negative and silently cancels out genuine,
// unrelated new loss in a different karat once added together.
export function calculateNetFineKarigarLoss(
  byKarat: Record<string, KarigarLossByKaratEntry>,
  clearedByKarat: Record<string, number> = {}
): number {
  let total = 0
  Object.entries(byKarat).forEach(([key, { karat, rawLoss }]) => {
    const cleared = clearedByKarat[key] || 0
    const net = Math.max(0, rawLoss - cleared)
    total += net * (karat / 100)
  })
  return parseFloat(total.toFixed(3))
}

// Same netting as above, but in raw karat-gold grams (mixed karats) instead of fine gold -
// drives the Dashboard's raw "Karigar Loss" display card.
export function calculateNetRawKarigarLoss(
  byKarat: Record<string, KarigarLossByKaratEntry>,
  clearedByKarat: Record<string, number> = {}
): number {
  let total = 0
  Object.entries(byKarat).forEach(([key, { rawLoss }]) => {
    const cleared = clearedByKarat[key] || 0
    total += Math.max(0, rawLoss - cleared)
  })
  return parseFloat(total.toFixed(3))
}

export interface FinishedGoodsByKaratEntry {
  karat: number
  weight: number // raw karat-gold weight (Finish Weight itself, not the fillingIn/finishWeight gap)
}

// Finish Weight for orders that are COMPLETED but not yet DELIVERED (billed) - this is the actual
// finished piece sitting in the shop, physically real gold that hasn't returned to Admin Stock and
// hasn't become a Customer Stock receivable yet either. Grouped per karat for fine conversion.
export function calculateFinishedGoodsByKarat(orders: KarigarLossOrderInput[]): Record<string, FinishedGoodsByKaratEntry> {
  const result: Record<string, FinishedGoodsByKaratEntry> = {}
  orders.forEach(o => {
    const karat = parseFloat(String(o.selectedKarat)) || 92
    const key = karatFieldKey(karat)
    const weight = o.finishWeight || 0
    if (!result[key]) result[key] = { karat, weight: 0 }
    result[key].weight += weight
  })
  Object.values(result).forEach(entry => {
    entry.weight = parseFloat(entry.weight.toFixed(3))
  })
  return result
}

export function calculateRawFinishedGoods(byKarat: Record<string, FinishedGoodsByKaratEntry>): number {
  let total = 0
  Object.values(byKarat).forEach(({ weight }) => {
    total += weight
  })
  return parseFloat(total.toFixed(3))
}

export function calculateFineFinishedGoods(byKarat: Record<string, FinishedGoodsByKaratEntry>): number {
  let total = 0
  Object.values(byKarat).forEach(({ karat, weight }) => {
    total += weight * (karat / 100)
  })
  return parseFloat(total.toFixed(3))
}

// Same per-karat-clamped netting as Karigar Loss, but for Finished Goods - used so a "start fresh"
// reset baseline can net out old Finished Goods too, without excluding whole orders by date (which
// would wrongly hide brand-new activity on an order that merely happened to be created earlier).
export function calculateNetRawFinishedGoods(
  byKarat: Record<string, FinishedGoodsByKaratEntry>,
  baselineByKarat: Record<string, number> = {}
): number {
  let total = 0
  Object.entries(byKarat).forEach(([key, { weight }]) => {
    const baseline = baselineByKarat[key] || 0
    total += Math.max(0, weight - baseline)
  })
  return parseFloat(total.toFixed(3))
}

export function calculateNetFineFinishedGoods(
  byKarat: Record<string, FinishedGoodsByKaratEntry>,
  baselineByKarat: Record<string, number> = {}
): number {
  let total = 0
  Object.entries(byKarat).forEach(([key, { karat, weight }]) => {
    const baseline = baselineByKarat[key] || 0
    const net = Math.max(0, weight - baseline)
    total += net * (karat / 100)
  })
  return parseFloat(total.toFixed(3))
}

// Adds two per-karat baseline maps together (e.g. the "Clear Total Loss" ratchet + a "start fresh"
// reset snapshot) so callers can net a live total against BOTH at once with a single combined map.
export function combineByKaratBaselines(
  a: Record<string, number> = {},
  b: Record<string, number> = {}
): Record<string, number> {
  const result: Record<string, number> = { ...a }
  Object.entries(b).forEach(([key, value]) => {
    result[key] = parseFloat(((result[key] || 0) + value).toFixed(3))
  })
  return result
}
