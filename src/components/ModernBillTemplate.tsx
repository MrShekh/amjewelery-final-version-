'use client'

import React from 'react'

interface ModernBillTemplateProps {
  billData: {
    customer: {
      name: string
      phone: string
      email?: string
      address?: string
    }
    bill: {
      billNo: string
      calculation: {
        completeOrderWeight: number
        kalesStoneWeight: number
        adWeight: number
        manufacturingCost: number
        removeKalesStone: boolean
        removeAdWeight: boolean
        advanceGoldUsed: number
        finalWeight: number
        remainingBalance: number
      }
      itemDetails?: Array<{
        description: string
        particulars: string
        rate: string
      }>
      termsAndConditions?: string
      notes?: string
      createdAt: string
    }
    orderId?: string
    orderName?: string
  }
}

const ModernBillTemplate: React.FC<ModernBillTemplateProps> = ({ billData }) => {
  const currentDate = new Date(billData.bill.createdAt).toLocaleDateString('en-IN')
  
  return (
    <div 
      id="modern-bill-template"
      className="bg-white p-8 max-w-4xl mx-auto font-sans text-black"
      style={{ 
        width: '210mm', 
        minHeight: '297mm', 
        fontSize: '14px',
        lineHeight: '1.4',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Header */}
      <div className="border-2 border-black rounded-lg p-6 mb-6">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold mb-2">AM JEWELLERS</h1>
          <h2 className="text-xl font-bold mb-1">BILL/INVOICE</h2>
        </div>
        
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="mb-2"><strong>To:</strong></p>
            <p className="font-semibold text-lg">{billData.customer.name}</p>
            <p>Phone: {billData.customer.phone}</p>
            {billData.customer.address && billData.customer.address !== 'Not provided' && (
              <p>{billData.customer.address}</p>
            )}
          </div>
          
          <div className="text-right">
            <p className="mb-2"><strong>Date:</strong> {currentDate}</p>
            <p className="mb-2"><strong>Bill No:</strong> {billData.bill.billNo}</p>
            {billData.orderName && (
              <p className="mb-2"><strong>Order:</strong> {billData.orderName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Weight Calculation Steps - Matching Live Preview */}
      <div className="border-2 border-black p-4 mb-4">
        <h3 className="text-lg font-bold mb-3">📊 Weight Calculation Steps</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Complete Order Weight:</span>
            <span className="font-medium">+{billData.bill.calculation.completeOrderWeight.toFixed(3)}g</span>
          </div>
          
          {billData.bill.calculation.removeKalesStone && billData.bill.calculation.kalesStoneWeight > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Kales Stone Weight (removed):</span>
              <span className="font-medium">-{billData.bill.calculation.kalesStoneWeight.toFixed(3)}g</span>
            </div>
          )}
          
          {billData.bill.calculation.removeAdWeight && billData.bill.calculation.adWeight > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Ad Weight (removed):</span>
              <span className="font-medium">-{billData.bill.calculation.adWeight.toFixed(3)}g</span>
            </div>
          )}
          
          {billData.bill.calculation.manufacturingCost > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Manufacturing Cost (added):</span>
              <span className="font-medium">+{billData.bill.calculation.manufacturingCost.toFixed(3)}g</span>
            </div>
          )}
          
          {/* Include stone weights if not removed */}
          {!billData.bill.calculation.removeKalesStone && billData.bill.calculation.kalesStoneWeight > 0 && (
            <div className="flex justify-between text-blue-600">
              <span>Kales Stone Weight (included):</span>
              <span className="font-medium">+{billData.bill.calculation.kalesStoneWeight.toFixed(3)}g</span>
            </div>
          )}
          
          {!billData.bill.calculation.removeAdWeight && billData.bill.calculation.adWeight > 0 && (
            <div className="flex justify-between text-blue-600">
              <span>Ad Weight (included):</span>
              <span className="font-medium">+{billData.bill.calculation.adWeight.toFixed(3)}g</span>
            </div>
          )}
          
          <hr className="my-2 border-black" />
          <div className="flex justify-between text-lg font-bold text-blue-600">
            <span>Total Billing Weight:</span>
            <span>{billData.bill.calculation.finalWeight.toFixed(3)}g</span>
          </div>
        </div>
      </div>

      {/* Final Billing Summary - Matching Live Preview */}
      <div className="border-2 border-black p-4 mb-4">
        <h3 className="text-lg font-bold mb-3">📋 Final Billing Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total Billing Weight:</span>
            <span className="font-medium text-blue-600">{billData.bill.calculation.finalWeight.toFixed(3)}g</span>
          </div>
          
          {billData.bill.calculation.advanceGoldUsed > 0 && (
            <div className="flex justify-between">
              <span>Less: Advance Gold Used:</span>
              <span className="font-medium text-green-600">-{billData.bill.calculation.advanceGoldUsed.toFixed(3)}g</span>
            </div>
          )}
          
          <hr className="my-2 border-black" />
          <div className="flex justify-between text-lg font-bold text-orange-600">
            <span>Net Customer Payment:</span>
            <span>{Math.max(0, billData.bill.calculation.remainingBalance).toFixed(3)}g</span>
          </div>
        </div>
      </div>

      {/* Item Details */}
      {billData.bill.itemDetails && billData.bill.itemDetails.length > 0 && (
        <div className="border-2 border-black p-4 mb-4">
          <h3 className="text-lg font-bold mb-3">📝 Item Details</h3>
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-3 text-left">Description</th>
                <th className="border border-black p-3 text-left">Particulars</th>
                <th className="border border-black p-3 text-left">Rate</th>
              </tr>
            </thead>
            <tbody>
              {billData.bill.itemDetails.map((item, index) => (
                <tr key={index}>
                  <td className="border border-black p-3">{item.description || '-'}</td>
                  <td className="border border-black p-3">{item.particulars || '-'}</td>
                  <td className="border border-black p-3">{item.rate || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BILLING SUMMARY */}
      <div className="border-2 border-black p-4 mb-4 bg-gray-50">
        <h3 className="text-xl font-bold mb-3 text-center">BILLING SUMMARY</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <h4 className="font-bold mb-2">Gold Balance:</h4>
            <p className="text-2xl font-bold text-red-600">
              Pending Gold Return: {Math.max(0, billData.bill.calculation.remainingBalance).toFixed(3)}g
            </p>
          </div>
          <div className="text-center">
            <h4 className="font-bold mb-2">Payment Balance:</h4>
            <p className="text-2xl font-bold text-red-600">
              Pending Amount: ₹{billData.bill.calculation.remainingBalance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Notes */}
      {billData.bill.notes && (
        <div className="border-2 border-black p-4 mb-4">
          <h3 className="text-lg font-bold mb-3">📝 Notes</h3>
          <p className="text-sm">{billData.bill.notes}</p>
        </div>
      )}

      {/* Terms and Conditions */}
      <div className="border-2 border-black p-4 mb-6">
        <h3 className="text-lg font-bold mb-3">Terms and Conditions</h3>
        <div className="text-sm space-y-1">
          {billData.bill.termsAndConditions ? (
            <p>{billData.bill.termsAndConditions}</p>
          ) : (
            <>
              <p>1. All payments are final</p>
              <p>2. Gold weight verified at time of delivery</p>
              <p>3. Any disputes should be raised within 24 hours</p>
              <p>4. This bill is computer generated and valid without signature</p>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end">
        <div className="text-sm text-gray-600">
          <p>Generated on: {new Date().toLocaleString('en-IN')}</p>
          {billData.orderId && <p>Order ID: #{billData.orderId.slice(-8)}</p>}
        </div>
        
        <div className="text-center">
          <div className="mb-16">
            <p className="font-bold">For AM JEWELLERS</p>
          </div>
          <div className="border-t border-black pt-2">
            <p className="font-semibold">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModernBillTemplate
