'use client'

import React from 'react'
import BillPreview from './BillPreview'

interface BillDisplayProps {
  bill: any
  onDownload?: () => void
}

const BillDisplay: React.FC<BillDisplayProps> = ({ bill, onDownload }) => {
  // Transform the bill data to match our BillPreview component format
  const order = {
    orderName: bill.order?.orderName || 'N/A',
    orderNumber: bill.order?.orderNumber,
    selectedKarat: bill.order?.selectedKarat || 92,
    actualGoldWeight: bill.order?.actualGoldWeight || 0,
    actualFinalWeight: bill.order?.actualFinalWeight || 0,
    totalStoneWeight: bill.order?.totalStoneWeight || 0,
    customer: {
      name: bill.order?.customer?.name || bill.customerName || 'N/A',
      phone: bill.order?.customer?.phone || bill.customerPhone || 'N/A',
      email: bill.order?.customer?.email,
      address: bill.order?.customer?.address
    },
    processes: bill.order?.processes || []
  }

  const calculations = {
    actualGoldWeight: bill.actualGoldWeight || order.actualGoldWeight,
    karatPurity: (order.selectedKarat || 92) / 100,
    actualGoldWeightInFineGold: bill.actualGoldWeightInFineGold || 0,
    manufacturingCostGrams: bill.manufacturingCostGrams || 0,
    manualStoneWeight: bill.manualStoneWeight || 0,
    manualAdWeight: bill.manualAdWeight || 0,
    totalManualStoneWeight: (bill.manualStoneWeight || 0) + (bill.manualAdWeight || 0),
    billingWeight: bill.billingWeight || order.actualGoldWeight,
    billingWeightInFineGold: bill.billingWeightInFineGold || 0,
    subtotalCustomerOwedFineGold: bill.subtotalCustomerOwedFineGold || 0,
    advanceGoldUsed: bill.advanceGoldUsed || 0,
    totalCustomerOwedFineGold: bill.totalCustomerOwedFineGold || 0
  }

  const billData = {
    manufacturingCostGrams: bill.manufacturingCostGrams?.toString() || '0',
    includeStones: bill.includeStones !== false,
    manualStoneWeight: bill.manualStoneWeight?.toString() || '0',
    manualAdWeight: bill.manualAdWeight?.toString() || '0',
    advanceGoldUsed: bill.advanceGoldUsed?.toString() || '0',
    notes: bill.notes || ''
  }

  return (
    <div className="space-y-6">
      {/* Bill Status Header */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">💰 Bill Details</h2>
            <p className="text-gray-600 mt-1">
              Bill Number: <span className="font-semibold text-blue-600">{bill.billNumber}</span>
            </p>
            <p className="text-sm text-gray-500">
              Created on: {new Date(bill.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              bill.status === 'PAID' 
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {bill.status === 'PAID' ? '✅ Paid' : '⏳ Pending'}
            </div>
            {bill.totalAmount && (
              <p className="text-lg font-bold text-green-600 mt-2">
                Total: {bill.totalAmount.toFixed(3)}g Fine Gold
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Professional Bill Preview */}
      <BillPreview
        order={order}
        calculations={calculations}
        billData={billData}
        billNumber={bill.billNumber}
        onDownload={onDownload}
      />

      {/* Additional Bill Information */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Transaction Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Inventory Impact</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Karigar Return Stock (decreased):</span>
                <span className="text-red-600 font-medium">-{calculations.actualGoldWeightInFineGold.toFixed(3)}g</span>
              </div>
              {calculations.advanceGoldUsed > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Advance Customer Stock (decreased):</span>
                    <span className="text-red-600 font-medium">-{calculations.advanceGoldUsed.toFixed(3)}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Admin Stock (increased):</span>
                    <span className="text-green-600 font-medium">+{calculations.advanceGoldUsed.toFixed(3)}g</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Customer Stock (increased):</span>
                <span className="text-green-600 font-semibold">+{calculations.totalCustomerOwedFineGold.toFixed(3)}g</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Payment Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Bill Status:</span>
                <span className={`font-medium ${bill.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {bill.status || 'PENDING'}
                </span>
              </div>
              {bill.paidAt && (
                <div className="flex justify-between">
                  <span>Paid Date:</span>
                  <span className="font-medium">{new Date(bill.paidAt).toLocaleDateString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="font-medium">{bill.paymentMethod || 'Not specified'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        {bill.status !== 'PAID' && (
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
            onClick={() => {
              // Handle mark as paid functionality
              if (confirm('Mark this bill as paid?')) {
                // You can implement the mark as paid API call here
                alert('Bill marked as paid successfully!')
              }
            }}
          >
            ✅ Mark as Paid
          </button>
        )}
        
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
          onClick={() => window.print()}
        >
          🖨️ Print Bill
        </button>
      </div>
    </div>
  )
}

export default BillDisplay
