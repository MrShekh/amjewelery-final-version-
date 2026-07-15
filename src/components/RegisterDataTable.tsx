'use client'

import RegisterTableRow from './RegisterTableRow'
import RegisterTotalsRow from './RegisterTotalsRow'

interface Order {
  id: string
  selectedKarat?: number | string
  orderNumber?: string
  orderName: string
  fillingKarigar?: string
  fillingIn?: number
  fillingOut?: number
  fillingLoss?: number
  ad?: number
  adNote?: string
  klStone?: number
  klStoneNote?: string
  settingKarigar?: string
  settingLoss?: number
  polishKarigar?: string
  polishLoss?: number
  finishWeight?: number
  makingCharge?: number
  orderPhoto?: string
  status: string
}

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

interface RegisterDataTableProps {
  orders: Order[]
  totals: Totals
  onEditCell: (order: Order, field: string, label: string) => void
  onDeleteRow: (order: Order) => void
  onImageClick: (url: string) => void
  onPhotoUpload: (orderId: string, file: File) => void
  onSaveRow: (order: Order) => void
  onCreateBill: (order: Order) => void
  page: number
  limit: number
  readOnly?: boolean
}

export default function RegisterDataTable({
  orders,
  totals,
  onEditCell,
  onDeleteRow,
  onImageClick,
  onPhotoUpload,
  onSaveRow,
  onCreateBill,
  page,
  limit,
  readOnly = false,
}: RegisterDataTableProps) {
  const headers = [
    { label: 'Sr No', className: 'text-center w-12 sticky left-0 z-20 bg-foreground border-r border-border/20' },
    { label: 'KT / Karat', className: 'border-r border-border/20 text-center w-20' },
    { label: 'Bag Number', className: 'border-r border-border/20' },
    { label: 'Order Name', className: 'border-r border-border/20 min-w-[120px]' },
    { label: 'Filling In', className: 'text-right border-r border-border/20' },
    { label: 'Finish Weight', className: 'text-right border-r border-border/20' },
    { label: readOnly ? 'Photo' : 'Photo & Actions', className: `${readOnly ? 'w-16' : 'w-32'} text-center` },
  ]

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={h.className}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map((order, index) => (
                <RegisterTableRow
                  key={order.id}
                  order={order}
                  index={(page - 1) * limit + index + 1}
                  onEditCell={onEditCell}
                  onDeleteRow={onDeleteRow}
                  onImageClick={onImageClick}
                  onPhotoUpload={onPhotoUpload}
                  onSaveRow={onSaveRow}
                  onCreateBill={onCreateBill}
                  readOnly={readOnly}
                />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-10 text-text-light bg-background/30">
                  No orders found. Create orders from the standard order creation page.
                </td>
              </tr>
            )}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <RegisterTotalsRow totals={totals} />
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
