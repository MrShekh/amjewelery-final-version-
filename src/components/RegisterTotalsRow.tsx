'use client'

interface Totals {
  fillingIn?: number
  fillingOut?: number
  fillingLoss?: number
  settingLoss?: number
  ad?: number
  klStone?: number
  polishLoss?: number
  finishWeight?: number
  makingCharge?: number
}

interface RegisterTotalsRowProps {
  totals: Totals
}

export default function RegisterTotalsRow({ totals }: RegisterTotalsRowProps) {
  return (
    <tr className="bg-foreground text-white font-bold border-t-2 border-primary">
      <td className="px-3 py-2 text-center sticky left-0 z-10 bg-foreground text-xs uppercase">Total</td>
      <td className="border-r border-border/10 text-center">-</td>
      <td className="border-r border-border/10 text-center">-</td>
      <td className="border-r border-border/10 text-center">-</td>
      <td className="px-3 py-2 text-right border-r border-border/10 font-bold">{(totals.fillingIn || 0).toFixed(3)} g</td>
      <td className="px-3 py-2 text-right border-r border-border/10 font-bold text-green-300">{(totals.finishWeight || 0).toFixed(3)} g</td>
      <td></td>
    </tr>
  )
}
