'use client'

import React from 'react'
import { getPurityDisplayName, KaratPurity } from '@/lib/gold-conversions'

interface ManufacturingWorksheetPreviewProps {
  orderNumber: string
  customerName: string
  orderName: string
  selectedKarat: number
  size: string
  totalWeight: string
  unit: string
  deliveryDate?: string
  imageUrl?: string
  adDetails?: { size: string; pieces: string | number; total: string | number }[]
}

const ManufacturingWorksheetPreview: React.FC<ManufacturingWorksheetPreviewProps> = ({
  orderNumber,
  customerName,
  orderName,
  selectedKarat,
  size,
  totalWeight,
  unit,
  deliveryDate,
  imageUrl,
  adDetails = []
}) => {
  // Helper function to get karat display
  const getKaratDisplay = (karat: number) => {
    const purityName = getPurityDisplayName(karat as KaratPurity)
    // Extract karat number and add KT suffix
    const karatNumber = purityName.split(' ')[0] // "22k" from "22k (92%)"
    return karatNumber.toUpperCase() + 'T' // "22KT"
  }

  // Convert weight to grams for display
  const convertToGrams = (value: string, unit: string) => {
    const numValue = parseFloat(value) || 0
    return unit === 'milligrams' ? (numValue / 1000).toFixed(3) : numValue.toFixed(3)
  }

  const weightInGrams = totalWeight ? convertToGrams(totalWeight, unit) : '0.000'

  return (
    <div className="bg-white p-2 rounded-lg shadow-lg border border-gray-300 relative" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', width: '400px' }}>
      {/* Header */}
      <div className="grid grid-cols-6 border border-black">
        <div className="bg-yellow-200 border-r border-black p-1 text-center font-bold text-xs">
          {orderNumber || 'BAG NO-'}
        </div>
        <div className="bg-yellow-200 border-r border-black p-1 text-center font-bold text-sm col-span-4">
          AM JEWELLARS
        </div>
        <div className="bg-yellow-200 p-1 text-center font-bold">
          
        </div>
      </div>

      {/* Customer Details Row */}
      <div className="grid grid-cols-6 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          DATE-
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center col-span-2">
          Customer Name
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          ORDER
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          {getKaratDisplay(selectedKarat)}
        </div>
        <div className="p-1 bg-gray-100 font-bold text-center">
          
        </div>
      </div>

      {/* Data Row */}
      <div className="grid grid-cols-6 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-1 text-center">
          {new Date().toLocaleDateString('en-GB')}
        </div>
        <div className="border-r border-black p-1 text-center col-span-2">
          {customerName || ''}
        </div>
        <div className="border-r border-black p-1 text-center">
          {orderName || ''}
        </div>
        <div className="border-r border-black p-1 text-center">
          {size ? `Size - ${size}` : ''}
        </div>
        <div className="p-1 text-center">
          D DATE -
        </div>
      </div>

      {/* Process Headers */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          IN
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          OUT
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          LOSS
        </div>
        <div className="p-1 bg-gray-100 font-bold text-center">
          {deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-GB') : ''}
        </div>
      </div>

      {/* FAILING Process */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 bg-gray-200 font-bold">
          FAILING
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="p-2 h-8">
          
        </div>
      </div>

      {/* Empty row under FAILING */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="p-2 h-6">
          
        </div>
      </div>

      {/* F PALISH Process */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 bg-gray-200 font-bold">
          F PALISH
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="p-2 h-8">
          
        </div>
      </div>

      {/* Empty row under F PALISH */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="p-2 h-6">
          
        </div>
      </div>

      {/* SETTING Process */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs relative">
        <div className="border-r border-black p-2 bg-gray-200 font-bold">
          SETTING
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="p-2 h-8 relative">
          {/* Product Image positioned in 5th column spanning SETTING and AD rows */}
          {imageUrl && (
            <div className="absolute inset-0 w-full border border-gray-400 bg-white overflow-hidden" style={{ height: '56px', zIndex: 10 }}>
              <img 
                src={imageUrl} 
                alt="Product"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* AD Stone Row */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 bg-blue-200 font-bold text-center">
          AD
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="p-2 h-6">
          {/* This cell is covered by the image above */}
        </div>
      </div>

      {/* KL Stone Row */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 bg-blue-200 font-bold text-center">
          KL
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="p-2 h-6 flex items-center justify-between">
          <span className="text-red-600 font-bold">WT-</span>
          <span className="text-xs font-bold text-blue-600">{weightInGrams}g</span>
        </div>
      </div>

      {/* TOTAL Row */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 bg-gray-200 font-bold text-center">
          TOTAL
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="p-2 h-6">
          
        </div>
      </div>

      {/* Empty row */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="border-r border-black p-2 h-6">
          
        </div>
        <div className="p-2 h-6 flex items-center justify-end">
          <span className="text-xs font-bold">FENESH WT</span>
        </div>
      </div>

      {/* PALISH Process */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-2 bg-gray-200 font-bold">
          PALISH
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="border-r border-black p-2 h-8">
          
        </div>
        <div className="p-2 h-8">
          
        </div>
      </div>

      {/* AD Details Header Row */}
      <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          AD SIZE
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          AD PIS
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          AD SIZ
        </div>
        <div className="border-r border-black p-1 bg-gray-100 font-bold text-center">
          AD PIS
        </div>
        <div className="p-1 bg-gray-100 font-bold text-center">
          TOTAL
        </div>
      </div>

      {/* AD Data Rows - Dynamic based on adDetails */}
      {adDetails.length > 0 ? (
        adDetails.map((ad, index) => {
          // For pairs, display two AD entries per row
          if (index % 2 === 0) {
            const nextAd = adDetails[index + 1]
            return (
              <div key={index} className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
                <div className="border-r border-black p-2 h-6 text-center text-xs">
                  {ad.size || ''}
                </div>
                <div className="border-r border-black p-2 h-6 text-center text-xs">
                  {ad.pieces || ''}
                </div>
                <div className="border-r border-black p-2 h-6 text-center text-xs">
                  {nextAd?.size || ''}
                </div>
                <div className="border-r border-black p-2 h-6 text-center text-xs">
                  {nextAd?.pieces || ''}
                </div>
                <div className="p-2 h-6 text-center text-xs">
                  {(Number(ad.total || 0) + Number(nextAd?.total || 0)).toString()}
                </div>
              </div>
            )
          }
          return null
        })
      ) : (
        <div className="grid grid-cols-5 border-l border-r border-b border-black text-xs">
          <div className="border-r border-black p-2 h-6">
            
          </div>
          <div className="border-r border-black p-2 h-6">
            
          </div>
          <div className="border-r border-black p-2 h-6">
            
          </div>
          <div className="border-r border-black p-2 h-6">
            
          </div>
          <div className="p-2 h-6">
            
          </div>
        </div>
      )}

      {/* TOTAL LOSS Row */}
      <div className="border-l border-r border-b border-black">
        <div className="bg-yellow-300 p-2 text-center font-bold text-xs">
          TOTAL LOSS
        </div>
        <div className="h-6 p-2">
          
        </div>
      </div>

      {/* Preview Badge */}
      <div className="mt-2 text-center">
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
          Live Preview
        </span>
      </div>
    </div>
  )
}

export default ManufacturingWorksheetPreview
