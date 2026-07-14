'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Karigar {
  id: string
  name: string
  phone?: string
  specialty?: string
  createdAt: string
  processes: Array<{
    id: string
    processType: string
    inputWeight: number
    outputWeight: number
    goldLoss: number
    goldRecovered?: number
    karigarMakingCharge?: number // Making charge taken by karigar
    adminRecoverable?: number // Actual amount admin can recover (loss - making charge)
    createdAt: string
    orderId: string
    order: {
      id: string
      orderNumber?: string // Add order number field for consistency
      customer: {
        name: string
      }
    } | null
  }>
}

const KarigarsPage = () => {
  const router = useRouter()
  const [karigars, setKarigars] = useState<Karigar[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialty: ''
  })

  // Helper function to safely convert to number and handle NaN
  const safeNumber = (value: any): number => {
    const num = parseFloat(String(value || 0))
    return isNaN(num) ? 0 : num
  }

  useEffect(() => {
    fetchKarigars()
  }, [])

  const fetchKarigars = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/karigars', {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })
      
      if (!response.ok) {
        console.error('Karigars fetch failed:', response.status)
        return
      }
      
      const data = await response.json()
      setKarigars(data.karigars)
    } catch (error) {
      console.error('Error fetching karigars:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/karigars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setShowModal(false)
        setFormData({ name: '', phone: '', specialty: '' })
        fetchKarigars()
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Error creating karigar:', error)
      alert('Failed to create karigar')
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Karigars (Artisans)</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          Add Karigar
        </button>
      </div>


      {/* Karigars Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Karigar
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Specialty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jobs Completed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {karigars.map((karigar) => {
              return (
                <tr 
                  key={karigar.id} 
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <Link href={`/karigars/${karigar.id}`} className="hover:underline">
                        <div className="text-sm font-semibold text-gray-900">{karigar.name}</div>
                      </Link>
                      <div className="text-sm text-gray-500">
                        Joined {new Date(karigar.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                    {karigar.phone || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                      {karigar.specialty || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full text-xs font-semibold">
                      {karigar.processes?.length || 0} jobs
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <Link
                      href={`/karigars/${karigar.id}`}
                      className="text-blue-600 hover:text-blue-900 font-semibold"
                    >
                      Recover Gold
                    </Link>
                    <Link
                      href={`/karigars/${karigar.id}/work-history`}
                      className="text-gray-600 hover:text-gray-900 font-semibold"
                    >
                      Work History
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Karigar</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Specialty
                  </label>
                  <input
                    type="text"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    placeholder="e.g., Ring Making, Chain Making, Polishing"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-4 pt-4">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    Add Karigar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setFormData({ name: '', phone: '', specialty: '' })
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KarigarsPage
