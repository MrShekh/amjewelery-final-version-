'use client'

import React from 'react'

interface BillItem {
  srNo: number
  orderDetail: string
  netWeight: string
  kalesStone: string
  adWeight: string
  makingCharge: string
  total: string
}

interface EnhancedBillTemplateProps {
  billData: {
    customerName: string
    phoneNumber?: string
    invoiceNumber: string
    date: string
    orderPhoto?: string
    items: BillItem[]
    // Additional fields for calculations
    totalNetWeight?: number
    totalKalesStone?: number
    totalAdWeight?: number
    totalMakingCharge?: number
    grandTotal?: number
  }
  showPreview?: boolean
}

const EnhancedBillTemplate: React.FC<EnhancedBillTemplateProps> = ({ 
  billData, 
  showPreview = false 
}) => {
  const currentDate = billData.date || new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).toUpperCase()

  return (
    <div 
      id="enhanced-bill-template"
      className="bg-white font-sans text-black"
      style={{ 
        width: showPreview ? '100%' : '210mm', 
        minHeight: showPreview ? 'auto' : '297mm', 
        fontSize: '14px',
        lineHeight: '1.4',
        fontFamily: 'Arial, sans-serif',
        padding: showPreview ? '16px' : '20mm',
        margin: '0 auto',
        transform: showPreview ? 'scale(0.8)' : 'none',
        transformOrigin: 'top left'
      }}
    >
      {/* Header Section */}
      <div className="flex justify-between items-start mb-8">
        {/* Left Side - Company Info */}
        <div>
          <h1 
            className="font-bold mb-3" 
            style={{ 
              fontSize: showPreview ? '20px' : '24px',
              textDecoration: 'underline'
            }}
          >
            AM Jwellers
          </h1>
          <div className="text-sm" style={{ fontSize: '14px', lineHeight: '1.5' }}>
            <p>Shekh Nayem</p>
            <p>Patavadi Chowk</p>
            <p>Phone 9907047429</p>
          </div>
        </div>

        {/* Right Side - Order Image */}
        <div className="flex flex-col items-end">
          {billData.orderPhoto ? (
            <img 
              src={billData.orderPhoto}
              alt="Order"
              className="border-2 border-gray-400 mb-2"
              style={{ 
                width: '100px', 
                height: '80px',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div 
              className="border-2 border-gray-400 bg-blue-100 flex items-center justify-center mb-2"
              style={{ width: '100px', height: '80px' }}
            >
              <div 
                className="bg-blue-600 rounded"
                style={{ width: '50px', height: '40px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bill Info Section */}
      <div className="flex justify-between items-start mb-8">
        {/* Left - Customer Info */}
        <div>
          <div className="mb-4">
            <span className="font-bold" style={{ fontSize: '16px' }}>TO :</span>
          </div>
          <div className="text-sm" style={{ fontSize: '14px' }}>
            <p className="font-medium" style={{ fontSize: '16px' }}>
              <span className="font-bold">Customer Name :</span> {billData.customerName || '_________________'}
            </p>
            {billData.phoneNumber && (
              <p style={{ marginTop: '4px' }}>Phone: {billData.phoneNumber}</p>
            )}
          </div>
        </div>

        {/* Right - Invoice Info */}
        <div className="text-right">
          <div className="text-sm" style={{ fontSize: '16px', lineHeight: '1.8' }}>
            <p style={{ marginBottom: '8px' }}>
              <span className="font-bold">INVOICE </span> {billData.invoiceNumber || '01'}
            </p>
            <p>
              <span className="font-bold">DATE: </span> {currentDate}
            </p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th className="border-2 border-black p-2 text-center bg-gray-50" style={{ width: '8%' }}>
                Sr No.
              </th>
              <th className="border-2 border-black p-2 text-center bg-gray-50" style={{ width: '25%' }}>
                Order Detail
              </th>
              <th className="border-2 border-black p-2 text-center bg-gray-50" style={{ width: '15%' }}>
                Net Weight
              </th>
              <th className="border-2 border-black p-2 text-center bg-gray-50" style={{ width: '13%' }}>
                Kales Stone
              </th>
              <th className="border-2 border-black p-2 text-center bg-gray-50" style={{ width: '13%' }}>
                Ad Weight
              </th>
              <th className="border-2 border-black p-2 text-center bg-gray-50" style={{ width: '13%' }}>
                Making Charge
              </th>
              <th className="border-2 border-black p-2 text-center bg-gray-50" style={{ width: '13%' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {billData.items.map((item) => (
              <tr key={item.srNo}>
                <td className="border border-black p-2 text-center">
                  {item.srNo}
                </td>
                <td className="border border-black p-2">
                  {item.orderDetail}
                </td>
                <td className="border border-black p-2 text-center">
                  {item.netWeight}
                </td>
                <td className="border border-black p-2 text-center">
                  {item.kalesStone}
                </td>
                <td className="border border-black p-2 text-center">
                  {item.adWeight}
                </td>
                <td className="border border-black p-2 text-center">
                  {item.makingCharge}
                </td>
                <td className="border border-black p-2 text-center font-semibold">
                  {item.total}
                </td>
              </tr>
            ))}
            
            {/* Add empty rows if needed to maintain table height */}
            {[...Array(Math.max(0, 5 - billData.items.length))].map((_, index) => (
              <tr key={`empty-${index}`}>
                <td className="border border-black p-2 text-center" style={{ height: '40px' }}>
                  {billData.items.length + index + 1}
                </td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2 text-center"></td>
                <td className="border border-black p-2 text-center"></td>
                <td className="border border-black p-2 text-center"></td>
                <td className="border border-black p-2 text-center"></td>
                <td className="border border-black p-2 text-center"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      {(billData.totalNetWeight || billData.totalKalesStone || billData.totalAdWeight || 
        billData.totalMakingCharge || billData.grandTotal) && (
        <div className="mb-6">
          <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
            <tbody>
              {billData.totalNetWeight && (
                <tr>
                  <td className="border border-black p-2 text-right font-semibold bg-gray-50" colSpan={2}>
                    Total Net Weight:
                  </td>
                  <td className="border border-black p-2 text-center font-bold">
                    {billData.totalNetWeight} gram
                  </td>
                </tr>
              )}
              {billData.totalKalesStone && (
                <tr>
                  <td className="border border-black p-2 text-right font-semibold bg-gray-50" colSpan={2}>
                    Total Kales Stone:
                  </td>
                  <td className="border border-black p-2 text-center font-bold">
                    {billData.totalKalesStone} gram
                  </td>
                </tr>
              )}
              {billData.totalAdWeight && (
                <tr>
                  <td className="border border-black p-2 text-right font-semibold bg-gray-50" colSpan={2}>
                    Total Ad Weight:
                  </td>
                  <td className="border border-black p-2 text-center font-bold">
                    {billData.totalAdWeight} gram
                  </td>
                </tr>
              )}
              {billData.totalMakingCharge && (
                <tr>
                  <td className="border border-black p-2 text-right font-semibold bg-gray-50" colSpan={2}>
                    Total Making Charge:
                  </td>
                  <td className="border border-black p-2 text-center font-bold">
                    {billData.totalMakingCharge} gram
                  </td>
                </tr>
              )}
              {billData.grandTotal && (
                <tr className="bg-yellow-100">
                  <td className="border-2 border-black p-2 text-right font-bold text-lg" colSpan={2}>
                    GRAND TOTAL:
                  </td>
                  <td className="border-2 border-black p-2 text-center font-bold text-lg">
                    {billData.grandTotal} gram
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Section */}
      <div className="mt-16 flex justify-between items-end">
        {/* Terms and Conditions */}
        <div style={{ width: '60%' }}>
          <h4 className="font-bold mb-2" style={{ fontSize: '12px' }}>Terms and Conditions</h4>
          <div className="text-xs" style={{ fontSize: '10px', lineHeight: '1.3' }}>
            <p className="mb-1">1. All payments are final</p>
            <p className="mb-1">2. Gold weight verified at time of delivery</p>
            <p className="mb-1">3. Any disputes should be raised within 24 hours</p>
            <p className="mb-1">4. This bill is computer generated and valid without signature</p>
          </div>
        </div>
        
        {/* Signature */}
        <div className="text-center" style={{ width: '35%' }}>
          <h4 className="font-bold mb-12" style={{ fontSize: '12px' }}>For AM JEWELLERS</h4>
          <div className="border-t border-black pt-2">
            <p className="font-semibold text-xs">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedBillTemplate
