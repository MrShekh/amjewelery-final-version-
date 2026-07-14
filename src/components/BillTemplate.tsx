'use client'

import React from 'react'

interface BillTemplateProps {
  billData: {
    customer: {
      name: string
      phone: string
      email: string
      address: string
    }
    order: {
      id: string
      orderName: string
      orderPhoto?: string
      status: string
      createdAt: string
      finalJewelryWeight: number
      manufacturingCost: number
    }
    billing: {
      goldToReturn: number
      manufacturingCostDue: number
      goldReturned: number
      manufacturingCostPaid: number
      goldPending: number
      costPending: number
      totalBillAmount: number
      billingCompleted: boolean
    }
    processes?: {
      id: string
      processType: string
      inputWeight: number
      outputWeight: number
      goldLoss: number
      goldRecovered: number
      karigarName: string
    }[]
  }
}

const BillTemplate: React.FC<BillTemplateProps> = ({ billData }) => {
  const currentDate = new Date().toLocaleDateString('en-IN')
  
  return (
    <div 
      id="bill-template"
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
            {billData.customer.address !== 'Not provided' && <p>{billData.customer.address}</p>}
          </div>
          
          {/* Order Photo Section */}
          <div className="flex flex-col items-center mx-4">
            {billData.order.orderPhoto ? (
              <div className="mb-2">
                <img 
                  src={billData.order.orderPhoto}
                  alt={billData.order.orderName}
                  className="border-2 border-gray-400 rounded"
                  style={{ 
                    width: '120px', 
                    height: '100px',
                    objectFit: 'cover'
                  }}
                />
                <p className="text-xs text-center mt-1 text-gray-600">Order Photo</p>
              </div>
            ) : (
              <div 
                className="border-2 border-gray-300 bg-gray-100 flex items-center justify-center mb-2 rounded"
                style={{ width: '120px', height: '100px' }}
              >
                <div className="text-center text-gray-500">
                  <div className="text-2xl mb-1">📷</div>
                  <p className="text-xs">No Photo</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="text-right">
            <p className="mb-2"><strong>Date:</strong> {currentDate}</p>
            <p className="mb-2"><strong>Order ID:</strong> #{billData.order.id.slice(-8)}</p>
            <p className="mb-2"><strong>Order:</strong> {billData.order.orderName}</p>
          </div>
        </div>
      </div>


      {/* Order Details */}
      <div className="border-2 border-black p-4 mb-4">
        <h3 className="text-lg font-bold mb-3">Order Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p><strong>Order Name:</strong> {billData.order.orderName}</p>
            <p><strong>Status:</strong> {billData.order.status}</p>
            <p><strong>Created:</strong> {new Date(billData.order.createdAt).toLocaleDateString('en-IN')}</p>
          </div>
          <div>
            <p><strong>Final Jewelry Weight:</strong> {billData.order.finalJewelryWeight.toFixed(3)}g</p>
            <p><strong>Manufacturing Cost:</strong> ₹{billData.order.manufacturingCost.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Weight Calculation Steps */}
      <div className="border-2 border-black p-4 mb-4">
        <h3 className="text-lg font-bold mb-3">📊 Weight Calculation Steps</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Complete Order Weight:</span>
            <span className="font-medium">+{billData.order.finalJewelryWeight.toFixed(3)}g</span>
          </div>
          {billData.billing.manufacturingCostDue > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Manufacturing Cost (added):</span>
              <span className="font-medium">+{billData.billing.manufacturingCostDue.toFixed(3)}g</span>
            </div>
          )}
          <hr className="my-2 border-black" />
          <div className="flex justify-between text-lg font-bold">
            <span>Total Billing Weight:</span>
            <span>{billData.billing.totalBillAmount.toFixed(3)}g</span>
          </div>
        </div>
      </div>

      {/* Billing Summary */}
      <div className="border-2 border-black p-4 mb-4">
        <h3 className="text-lg font-bold mb-3">💰 BILLING SUMMARY</h3>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h4 className="font-bold mb-2">Gold Balance:</h4>
            <p className="text-red-600 font-bold text-xl">Pending Gold Return: {billData.billing.goldPending.toFixed(3)}g</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">Payment Balance:</h4>
            <p className="text-red-600 font-bold text-xl">Pending Amount: ₹{billData.billing.costPending.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Process Details */}
      {billData.processes && billData.processes.length > 0 && (
        <div className="border-2 border-black p-4 mb-4">
          <h3 className="text-lg font-bold mb-3">Manufacturing Process Details</h3>
          <table className="w-full border-collapse border border-black text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2">Process</th>
                <th className="border border-black p-2">Karigar</th>
                <th className="border border-black p-2">Input (g)</th>
                <th className="border border-black p-2">Output (g)</th>
                <th className="border border-black p-2">Loss (g)</th>
                <th className="border border-black p-2">Recovered (g)</th>
              </tr>
            </thead>
            <tbody>
              {billData.processes.map((process, index) => (
                <tr key={process.id}>
                  <td className="border border-black p-2">{process.processType}</td>
                  <td className="border border-black p-2">{process.karigarName}</td>
                  <td className="border border-black p-2 text-right">{process.inputWeight.toFixed(3)}</td>
                  <td className="border border-black p-2 text-right">{process.outputWeight.toFixed(3)}</td>
                  <td className="border border-black p-2 text-right">{process.goldLoss.toFixed(3)}</td>
                  <td className="border border-black p-2 text-right">{process.goldRecovered.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Section */}
      <div className="border-2 border-black p-4 mb-4 bg-gray-50">
        <h3 className="text-xl font-bold mb-3">BILLING SUMMARY</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-bold text-lg mb-2">Gold Balance:</h4>
            <p className="text-lg"><strong>Pending Gold Return:</strong> <span className="text-red-600">{billData.billing.goldPending.toFixed(3)}g</span></p>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-2">Payment Balance:</h4>
            <p className="text-lg"><strong>Pending Amount:</strong> <span className="text-red-600">₹{billData.billing.costPending.toFixed(2)}</span></p>
          </div>
        </div>
        
        {billData.billing.billingCompleted && (
          <div className="mt-4 p-3 bg-green-100 border border-green-400 rounded">
            <p className="text-green-800 font-bold text-center">✅ BILLING COMPLETED</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end mt-8">
        <div>
          <h4 className="font-bold mb-2">Terms and Conditions</h4>
          <div className="text-sm">
            <p className="mb-1">1. All payments are final</p>
            <p className="mb-1">2. Gold weight verified at time of delivery</p>
            <p className="mb-1">3. Any disputes should be raised within 24 hours</p>
            <p className="mb-1">4. This bill is computer generated and valid without signature</p>
          </div>
        </div>
        
        <div className="text-center">
          <h4 className="font-bold mb-16">For AM JEWELLERS</h4>
          <div className="border-t border-black pt-2">
            <p className="font-semibold">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BillTemplate
