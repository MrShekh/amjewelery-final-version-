'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

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
}

interface Karigar {
  id: string
  name: string
  specialty?: string
}

interface RegisterEditCellModalProps {
  order: Order
  field: string
  label: string
  onClose: () => void
  onSave: (payload: { orderId: string; field: string;[key: string]: any }) => void
  loading: boolean
  karigars: Karigar[]
}

export default function RegisterEditCellModal({
  order,
  field,
  label,
  onClose,
  onSave,
  loading,
  karigars = []
}: RegisterEditCellModalProps) {
  const isNumeric = [
    'fillingIn',
    'finishWeight',
  ].includes(field)

  const isNote = [] as string[]
  const isTextField = ['bagNumber', 'orderName', 'karat', 'fillingKarigar'].includes(field)
  const isKarigarField = ['fillingKarigar'].includes(field)

  const [mode, setMode] = useState<'add' | 'replace'>('add')
  const [value, setValue] = useState<string>('')

  // Helper to get current cell value
  const getCurrentValue = (): any => {
    if (field === 'bagNumber') return order.orderNumber || ''
    if (field === 'karat') return order.selectedKarat || ''
    return (order as any)[field] || ''
  }

  const currentValue = getCurrentValue()

  useEffect(() => {
    if (isNumeric) {
      setValue('')
    } else {
      setValue(currentValue?.toString() || '')
    }
  }, [field, order, isNumeric, currentValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const updatePayload: Record<string, any> = {
      orderId: order.id,
      field,
    }

    if (isNumeric) {
      const numVal = parseFloat(value)
      if (isNaN(numVal)) {
        alert('Please enter a valid number')
        return
      }
      updatePayload[field] = numVal
      updatePayload.additive = mode === 'add'
    } else {
      // Map back karat and bagNumber if needed
      if (field === 'karat') {
        updatePayload.karat = value
      } else if (field === 'bagNumber') {
        updatePayload.bagNumber = value
      } else {
        updatePayload[field] = value
      }
      updatePayload.additive = false
    }

    onSave(updatePayload as any)
  }

  const renderInputField = () => {
    if (isKarigarField) {
      return (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
          required
          autoFocus
        >
          <option value="">-- Select Karigar --</option>
          {karigars.map((k) => (
            <option key={k.id} value={k.name}>
              {k.name} {k.specialty ? `(${k.specialty})` : ''}
            </option>
          ))}
        </select>
      )
    }

    if (isNote) {
      return (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input min-h-[80px]"
          autoFocus
          id="edit-textarea-value"
        />
      )
    }

    // Default text fields
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input"
        required={field === 'orderName' || field === 'bagNumber'}
        autoFocus
        id="edit-text-value"
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content text-foreground" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit {label}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-background p-3 rounded-lg text-sm space-y-1 border border-border">
            <div className="flex justify-between">
              <span className="text-text-muted">Bag Number:</span>
              <span className="font-semibold">{order.orderNumber || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Order Name:</span>
              <span className="font-semibold">{order.orderName}</span>
            </div>
            {isNumeric && (
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="text-text-muted">Current {label}:</span>
                <span className="font-bold">
                  {currentValue || 0} g
                </span>
              </div>
            )}
          </div>

          {isNumeric ? (
            <div className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-text-muted">
                  <input
                    type="radio"
                    checked={mode === 'add'}
                    onChange={() => setMode('add')}
                    className="accent-primary"
                  />
                  <span>Add to existing</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-text-muted">
                  <input
                    type="radio"
                    checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                    className="accent-primary"
                  />
                  <span>Replace completely</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  {mode === 'add' ? 'Amount to Add' : 'New Amount'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="input"
                  placeholder="0.00"
                  required
                  autoFocus
                  id="edit-numeric-value"
                />
              </div>

              {value && !isNaN(parseFloat(value)) && (
                <div className="p-2.5 bg-accent/10 border border-accent/30 rounded-lg text-xs flex justify-between items-center text-text-muted">
                  <span>Preview Calculation:</span>
                  <span className="font-semibold text-foreground">
                    {mode === 'add'
                      ? `${currentValue || 0} + ${value} = ${((currentValue || 0) + parseFloat(value)).toFixed(3)} g`
                      : `${value} g`}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">
                {label} Value
              </label>
              {renderInputField()}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              id="confirm-edit-btn"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
