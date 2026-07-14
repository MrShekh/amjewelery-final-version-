'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { KARAT_PURITY_VALUES, KaratPurity, getPurityDisplayName } from '@/lib/gold-conversions'
import ManufacturingWorksheetPreview from './ManufacturingWorksheetPreview'
import { downloadManufacturingWorksheetExcel } from '@/utils/excelWorksheetGenerator'

interface Customer {
  id: string
  name: string
  phone?: string
}

const NewOrderPage = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [nextOrderNumber, setNextOrderNumber] = useState<string>('')
  const [isOrderNumberEditable, setIsOrderNumberEditable] = useState(false)
  const [customOrderNumber, setCustomOrderNumber] = useState<string>('')

  // All orders now use Karigar stock only
  const [formData, setFormData] = useState({
    customerId: searchParams.get('customerId') || '',
    orderName: '',
    orderPhoto: '',
    size: '',
    totalWeight: '',
    selectedKarat: 92 as KaratPurity, // Default to 22k (92%)
    customerProvidedGold: false, // Boolean: Has customer provided gold for this order?
    customerAdvanceGold: '',
    advanceGoldDescription: '',
    deliveryDate: '' // Delivery date field
  })

  // AD Details as separate state for multiple entries
  const [adDetails, setAdDetails] = useState([
    { size: '', pieces: '', total: '' }
  ])

  // Removed stone arrays - stones will be handled in manufacturing processes

  const [units, setUnits] = useState({
    totalWeightUnit: 'grams'
  })

  useEffect(() => {
    fetchCustomers()
    fetchNextOrderNumber()
  }, [])

  const fetchCustomers = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/customers?mode=dropdown', {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      const data = await response.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      setCustomers([])
    }
  }

  const fetchNextOrderNumber = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/orders/next-number', {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      const data = await response.json()
      if (data.nextOrderNumber) {
        setNextOrderNumber(data.nextOrderNumber)
      }
    } catch (error) {
      console.error('Error fetching next order number:', error)
      setNextOrderNumber('118') // Fallback to 118 if API fails
    }
  }

  // Convert to grams for API submission
  const convertToGrams = (value: string | number, unit: string) => {
    const numValue = typeof value === 'string' ? (parseFloat(value) || 0) : value
    return unit === 'milligrams' ? numValue / 1000 : numValue
  }

  // Stone management removed - stones are now handled in manufacturing processes

  // const convertFromGrams = (value: number, unit: string) => {
  //   return unit === 'milligrams' ? value * 1000 : value
  // }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid image file (JPG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      alert('File size too large. Please select an image smaller than 5MB.')
      return
    }

    setSelectedFile(file)

    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const sessionToken = localStorage.getItem('sessionToken')
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    const data = await response.json()
    return data.url
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let photoUrl = ''

      // Upload photo if selected
      if (selectedFile) {
        setUploading(true)
        try {
          photoUrl = await uploadFile(selectedFile)
        } catch (error) {
          alert(`Photo upload failed: ${error}`)
          return
        } finally {
          setUploading(false)
        }
      }

      // Convert weight to grams
      const totalWeightInGrams = convertToGrams(formData.totalWeight, units.totalWeightUnit)

      // Convert advance gold to number
      const advanceGoldAmount = parseFloat(formData.customerAdvanceGold) || 0

      // Simplified submission data for Karigar stock only orders
      const submissionData = {
        customerId: formData.customerId,
        orderName: formData.orderName,
        orderPhoto: photoUrl,
        orderType: 'KARIGAR_STOCK', // All orders use Karigar stock
        size: formData.size,
        finalJewelryWeight: totalWeightInGrams,
        selectedKarat: formData.selectedKarat, // Karat purity selection
        customerProvidedGold: formData.customerProvidedGold, // Boolean: Has customer provided gold?
        customerAdvanceGold: advanceGoldAmount, // Customer advance gold amount (only if customer provided gold)
        ...(advanceGoldAmount > 0 && formData.advanceGoldDescription && {
          advanceGoldDescription: formData.advanceGoldDescription
        }),
        // Include delivery date if provided
        ...(formData.deliveryDate && {
          deliveryDate: formData.deliveryDate
        }),
        // Include custom order number if provided
        ...(isOrderNumberEditable && customOrderNumber.trim() && {
          customOrderNumber: customOrderNumber.trim()
        }),
        // Include AD details if provided (filter out empty entries)
        adDetails: adDetails.filter(ad => ad.size || ad.pieces || ad.total).map(ad => ({
          size: ad.size || '',
          pieces: ad.pieces ? parseInt(String(ad.pieces)) || 0 : 0,
          total: ad.total ? parseFloat(String(ad.total)) || 0 : 0
        }))
        // Stones removed from order creation - will be handled in manufacturing processes
      }

      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(submissionData),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/orders/${data.order.id}`)
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  // Calculate simple totals for display
  const totalWeightInGrams = convertToGrams(formData.totalWeight, units.totalWeightUnit)

  // Get selected customer name for preview
  const selectedCustomer = customers.find(c => c.id === formData.customerId)
  const customerName = selectedCustomer ? selectedCustomer.name : ''

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Order</h1>
        <p className="mt-2 text-gray-600">
          Create a new jewelry manufacturing order using Karigar stock
        </p>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <span className="text-blue-600 mr-2">ℹ️</span>
            <span className="text-sm font-medium text-blue-800">
              All orders now use Karigar Stock only - Simplified order creation process
            </span>
          </div>
        </div>
      </div>

      {/* Side-by-side layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Order Form - Left Side */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Details</h2>
            <p className="text-sm text-gray-600">Fill in the order information below</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Order Number Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Number
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={isOrderNumberEditable ? customOrderNumber : nextOrderNumber}
                  readOnly={!isOrderNumberEditable}
                  onChange={(e) => setCustomOrderNumber(e.target.value)}
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm ${isOrderNumberEditable
                      ? 'focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                      : 'bg-gray-50 text-gray-700 cursor-not-allowed'
                    }`}
                  placeholder={isOrderNumberEditable ? "Enter custom order number" : "Loading..."}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (isOrderNumberEditable) {
                      // Switch back to auto-generated
                      setIsOrderNumberEditable(false)
                      setCustomOrderNumber('')
                    } else {
                      // Switch to editable mode
                      setIsOrderNumberEditable(true)
                      setCustomOrderNumber(nextOrderNumber)
                    }
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-md ${isOrderNumberEditable
                      ? 'bg-gray-500 hover:bg-gray-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                  {isOrderNumberEditable ? 'Auto' : 'Edit'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {isOrderNumberEditable
                  ? 'Enter a custom order number or click "Auto" to use auto-generated number.'
                  : 'This order number will be automatically assigned. Click "Edit" to customize it.'}
              </p>
            </div>

            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer *
              </label>
              <select
                required
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a customer</option>
                {customers && customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone && `(${customer.phone})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Name *
              </label>
              <input
                type="text"
                required
                value={formData.orderName}
                onChange={(e) => setFormData({ ...formData, orderName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter order name (e.g. Gold Ring, Necklace, etc.)"
              />
            </div>

            {/* Order Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Photo
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploading && (
                  <span className="text-sm text-blue-600">Uploading...</span>
                )}
              </div>
              {photoPreview && (
                <div className="mt-2">
                  <img
                    src={photoPreview}
                    alt="Order preview"
                    className="w-32 h-32 object-cover rounded-md border border-gray-300"
                  />
                </div>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Upload a photo of the order (optional). Max size: 5MB. Formats: JPG, PNG, GIF, WebP
              </p>
            </div>

            {/* Size Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Size
              </label>
              <input
                type="text"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter size (e.g. 7, L, XL, etc.)"
              />
            </div>

            {/* Delivery Date Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Date
              </label>
              <input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Expected delivery date for this order (optional).
              </p>
            </div>

            {/* Total Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Weight *
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={formData.totalWeight}
                  onChange={(e) => setFormData({ ...formData, totalWeight: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter total weight"
                />
                <select
                  value={units.totalWeightUnit}
                  onChange={(e) => setUnits({ ...units, totalWeightUnit: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="grams">Grams</option>
                  <option value="milligrams">Milligrams</option>
                </select>
              </div>
            </div>

            {/* Karat Purity Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Karat Purity *
              </label>
              <select
                required
                value={formData.selectedKarat}
                onChange={(e) => setFormData({ ...formData, selectedKarat: parseFloat(e.target.value) as KaratPurity })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {KARAT_PURITY_VALUES.map((purity) => (
                  <option key={purity} value={purity}>
                    {getPurityDisplayName(purity)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Select the karat purity for this jewelry order.
              </p>
            </div>

            {/* AD Details Section */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">AD Details</h3>
                <button
                  type="button"
                  onClick={() => setAdDetails([...adDetails, { size: '', pieces: '', total: '' }])}
                  className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  + Add AD
                </button>
              </div>

              <div className="space-y-4">
                {adDetails.map((ad, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">AD Entry #{index + 1}</span>
                      {adDetails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newAdDetails = adDetails.filter((_, i) => i !== index)
                            setAdDetails(newAdDetails)
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* AD Size */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          AD Size
                        </label>
                        <input
                          type="text"
                          value={ad.size}
                          onChange={(e) => {
                            const newAdDetails = [...adDetails]
                            newAdDetails[index].size = e.target.value
                            setAdDetails(newAdDetails)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g. 2mm, 3mm"
                        />
                      </div>

                      {/* AD Pieces */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          AD Pieces (Pis)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={ad.pieces}
                          onChange={(e) => {
                            const newAdDetails = [...adDetails]
                            newAdDetails[index].pieces = e.target.value
                            setAdDetails(newAdDetails)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Number of pieces"
                        />
                      </div>

                      {/* AD Total */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          AD Total
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={ad.total}
                          onChange={(e) => {
                            const newAdDetails = [...adDetails]
                            newAdDetails[index].total = e.target.value
                            setAdDetails(newAdDetails)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Total weight/value"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-2 text-sm text-gray-600">
                AD (American Diamond) details for stone setting calculations during manufacturing.
              </p>
            </div>

            {/* Note about stones */}
            <div className="border-t pt-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-yellow-600 mr-2">💎</span>
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Stone Setting</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Stones (AD/Kales) are now handled during the Stone Setting manufacturing process, not during order creation.
                    </p>
                  </div>
                </div>
              </div>
            </div>


            {/* Summary */}
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Order Summary</h3>
              <div className="space-y-1 text-sm">
                {(nextOrderNumber || (isOrderNumberEditable && customOrderNumber)) && (
                  <div className="flex justify-between">
                    <span>Order Number:</span>
                    <span className="font-medium text-purple-600">
                      {isOrderNumberEditable && customOrderNumber.trim() ? customOrderNumber.trim() : nextOrderNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Gold Weight (from Karigar Stock):</span>
                  <span className="font-medium text-blue-600">{totalWeightInGrams.toFixed(3)}g</span>
                </div>
                <div className="flex justify-between">
                  <span>Karat Purity:</span>
                  <span className="font-medium">{getPurityDisplayName(formData.selectedKarat)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="font-medium">{formData.size || 'Not specified'}</span>
                </div>
                {adDetails.some(ad => ad.size || ad.pieces || ad.total) && (
                  <div className="border-t pt-2 mt-2">
                    <div className="text-sm font-medium text-gray-800 mb-1">AD Details:</div>
                    {adDetails.filter(ad => ad.size || ad.pieces || ad.total).map((ad, index) => (
                      <div key={index} className="text-xs text-purple-600 ml-2">
                        #{index + 1}: {ad.size && `${ad.size}`}{ad.size && ad.pieces && ', '}{ad.pieces && `${ad.pieces} pcs`}{(ad.size || ad.pieces) && ad.total && ', '}{ad.total && `${parseFloat(String(ad.total)) || 0}`}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Stock Type:</span>
                  <span className="font-medium text-blue-600">Karigar Stock Only</span>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-md font-medium"
              >
                {loading ? 'Creating...' : 'Create Order'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Excel Preview - Right Side */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Manufacturing Worksheet Preview</h2>
            <p className="text-sm text-gray-600">Live preview of the Excel worksheet that will be generated</p>
          </div>

          <ManufacturingWorksheetPreview
            orderNumber={isOrderNumberEditable && customOrderNumber.trim() ? customOrderNumber.trim() : nextOrderNumber}
            customerName={customerName}
            orderName={formData.orderName}
            selectedKarat={formData.selectedKarat}
            size={formData.size}
            totalWeight={formData.totalWeight}
            unit={units.totalWeightUnit}
            deliveryDate={formData.deliveryDate}
            imageUrl={formData.orderPhoto || photoPreview}
            adDetails={adDetails}
          />

          {/* Action Buttons for Preview */}
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              onClick={async () => {
                try {
                  await downloadManufacturingWorksheetExcel({
                    orderNumber: isOrderNumberEditable && customOrderNumber.trim() ? customOrderNumber.trim() : nextOrderNumber,
                    customerName: customerName,
                    orderName: formData.orderName,
                    selectedKarat: formData.selectedKarat,
                    size: formData.size,
                    totalWeight: formData.totalWeight,
                    unit: units.totalWeightUnit,
                    deliveryDate: formData.deliveryDate,
                    imageUrl: formData.orderPhoto || photoPreview,
                    adDetails: adDetails
                  })
                } catch (error) {
                  alert('Failed to export Excel worksheet. Please try again.')
                }
              }}
            >
              📊 Export to Excel
            </button>
            <button
              type="button"
              className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              onClick={() => window.print()}
            >
              🖨️ Print Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewOrderPage
