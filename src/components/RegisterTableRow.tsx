'use client'

import React from 'react'
import { Trash2, Camera, Save, FileText } from 'lucide-react'

interface Order {
  id: string
  _id?: string
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

interface RegisterTableRowProps {
  order: Order
  index: number
  onEditCell: (order: Order, field: string, label: string) => void
  onDeleteRow: (order: Order) => void
  onImageClick: (url: string) => void
  onPhotoUpload: (orderId: string, file: File) => void
  onSaveRow: (order: Order) => void
  onCreateBill: (order: Order) => void
  readOnly?: boolean
}

export default function RegisterTableRow({
  order,
  index,
  onEditCell,
  onDeleteRow,
  onImageClick,
  onPhotoUpload,
  onSaveRow,
  onCreateBill,
  readOnly = false
}: RegisterTableRowProps) {
  const isEditable = !readOnly && order.status !== 'DELIVERED'

  const handleCellClick = (field: string, label: string) => {
    if (!isEditable) return
    onEditCell(order, field, label)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onPhotoUpload(order.id, file)
    }
  }

  const getKaratDisplay = (karat?: number | string) => {
    if (karat === undefined || karat === null || karat === '') {
      return <span className="text-text-light italic">-</span>
    }
    if (typeof karat === 'number') {
      switch (karat) {
        case 92: return '22k (92%)'
        case 75.5: return '18k (75.5%)'
        case 80: return '19.2k (80%)'
        case 59: return '14.2k (59%)'
        case 37.5: return '9k (37.5%)'
        default: return `${karat}%`
      }
    }
    return karat
  }

  return (
    <tr className="hover:bg-accent/10 border-b border-border">
      {/* Sr No */}
      <td className="px-3 py-2 text-xs font-semibold text-text-muted text-center bg-background/50 sticky left-0 z-10 border-r border-border">
        {index}
      </td>

      {/* KT / Karat */}
      <td
        onClick={!isEditable ? undefined : () => handleCellClick('karat', 'KT / Karat')}
        className={`px-3 py-2 text-sm text-center text-foreground border-r border-border font-medium ${isEditable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
      >
        {getKaratDisplay(order.selectedKarat)}
      </td>

      {/* Bag Number */}
      <td
        onClick={!isEditable ? undefined : () => handleCellClick('bagNumber', 'Bag Number')}
        className={`px-3 py-2 text-sm font-semibold text-foreground border-r border-border ${isEditable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
      >
        {order.orderNumber || <span className="text-text-light italic">-</span>}
      </td>

      {/* Order Name */}
      <td
        onClick={!isEditable ? undefined : () => handleCellClick('orderName', 'Order Name')}
        className={`px-3 py-2 text-sm text-foreground border-r border-border min-w-[120px] max-w-[200px] truncate ${isEditable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
      >
        {order.orderName}
      </td>

      {/* Filling Karigar */}
      <td
        onClick={!isEditable ? undefined : () => handleCellClick('fillingKarigar', 'Filling Karigar')}
        className={`px-3 py-2 text-sm text-foreground border-r border-border font-medium ${isEditable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
      >
        {order.fillingKarigar || <span className="text-text-light italic">{!isEditable ? '-' : 'Assign...'}</span>}
      </td>

      {/* Filling In */}
      <td
        onClick={!isEditable ? undefined : () => handleCellClick('fillingIn', 'Filling In')}
        className={`px-3 py-2 text-sm text-right text-foreground border-r border-border ${isEditable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
      >
        {(order.fillingIn || 0).toFixed(3)} g
      </td>

      {/* Finish Weight */}
      <td
        onClick={!isEditable ? undefined : () => handleCellClick('finishWeight', 'Finish Weight')}
        className={`px-3 py-2 text-sm text-right text-foreground border-r border-border ${isEditable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
      >
        {(order.finishWeight || 0).toFixed(3)} g
      </td>


      {/* Image & Actions */}
      <td className={`px-3 py-1.5 flex items-center ${readOnly ? 'justify-center' : 'justify-between'} gap-2 ${readOnly ? 'min-w-[60px]' : 'min-w-[140px]'}`}>
        {/* Photo thumbnail */}
        <div className="flex items-center gap-1.5">
          {order.orderPhoto ? (
            <div className="relative group">
              <img
                src={order.orderPhoto}
                alt="Order"
                className="w-8 h-8 rounded object-cover border border-border cursor-pointer hover:scale-105 transition-transform"
                onClick={() => onImageClick(order.orderPhoto!)}
              />
              {isEditable && (
                <label className="absolute -bottom-1 -right-1 bg-surface border border-border rounded-full p-0.5 cursor-pointer shadow hover:bg-background hidden group-hover:block">
                  <Camera className="w-2.5 h-2.5 text-text-muted" />
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </label>
              )}
            </div>
          ) : (
            !isEditable ? (
              <span className="text-text-light italic text-xs">-</span>
            ) : (
              <label className="w-8 h-8 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-background">
                <Camera className="w-4 h-4 text-text-light" />
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </label>
            )
          )}
        </div>

        {/* Action buttons - hidden in readOnly mode */}
        {!readOnly && (
          <div className="flex items-center gap-1">
            {/* Save button */}
            <button
              onClick={() => onSaveRow(order)}
              disabled={order.status === 'DELIVERED'}
              className={`p-1 rounded transition-colors ${order.status === 'DELIVERED'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : order.status === 'COMPLETED'
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              title={order.status === 'COMPLETED' ? 'Saved (Click to Re-save)' : 'Save Order Details (Finalize Weights)'}
            >
              <Save className="w-3.5 h-3.5" />
            </button>

            {/* Create Bill button */}
            <button
              onClick={() => onCreateBill(order)}
              disabled={order.status !== 'COMPLETED' && order.status !== 'DELIVERED'}
              className={`p-1 rounded transition-colors ${order.status !== 'COMPLETED' && order.status !== 'DELIVERED'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              title={
                order.status !== 'COMPLETED' && order.status !== 'DELIVERED'
                  ? 'Save order details first before creating bill'
                  : 'Create Customer Bill'
              }
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            {/* Delete button */}
            <button
              onClick={() => onDeleteRow(order)}
              className="p-1 rounded transition-colors text-text-light hover:text-danger hover:bg-danger-light"
              title="Delete Order"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
