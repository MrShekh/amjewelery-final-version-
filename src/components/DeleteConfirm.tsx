'use client'

import { X, AlertTriangle } from 'lucide-react'

interface DeleteConfirmProps {
  order: {
    bagNumber: string
    orderName: string
    status?: string
  }
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}

export default function DeleteConfirm({ order, onClose, onConfirm, loading }: DeleteConfirmProps) {
  return (
    <div className="modal-overlay text-foreground" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Delete Order
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm">
            Are you sure you want to delete this order? This action cannot be undone.
          </p>

          {order.status === 'DELIVERED' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs font-semibold space-y-1">
              ⚠️ WARNING: This order has been BILLED. Deleting it will also delete the associated customer bill, reverse all customer/admin stock updates, and clear the gold transaction and jama balance details.
            </div>
          )}

          <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Bag Number:</span>
              <span className="font-semibold text-red-600">{order.bagNumber || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Order Name:</span>
              <span className="font-semibold text-red-600">{order.orderName}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="btn btn-danger"
              id="confirm-delete-btn"
            >
              {loading ? 'Deleting...' : 'Delete Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
