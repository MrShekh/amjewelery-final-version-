'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface ManagerGoldEntry {
    _id?: string
    id?: string
    date: Date | string
    karat: number
    weight: number
    type: 'ADMIN_TO_MANAGER' | 'MANAGER_TO_ADMIN'
    description?: string
    orderId?: string
    createdAt: Date | string
}

interface ManagerGoldStock {
    id?: string
    stock22k: number
    stock75k: number
    stock76k: number
    stock80k: number
    stock88k: number
    stock92k: number
    stock59k: number
    stock755k: number
    stock375k: number
    stock9k: number
    entries: ManagerGoldEntry[]
    lastUpdated: Date | string
    createdAt: Date | string
}

const ManagerPage = () => {
    const { user } = useAuth()
    const [managerStock, setManagerStock] = useState<ManagerGoldStock | null>(null)
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)

    // Form state
    const [formDate, setFormDate] = useState(() => {
        const today = new Date()
        return today.toISOString().split('T')[0]
    })
    const [formKarat, setFormKarat] = useState<number>(22)
    const [formWeight, setFormWeight] = useState<string>('')
    const [formDescription, setFormDescription] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)

    const karatOptions = [22, 75, 75.5, 76, 80, 88, 92, 59, 9, 37.5]

    const fetchManagerStock = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('sessionToken')
            const response = await fetch('/api/manager-stock', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (response.ok) {
                const data = await response.json()
                setManagerStock(data.data)
            } else {
                console.error('Failed to fetch manager stock')
            }
        } catch (error) {
            console.error('Error fetching manager stock:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user) {
            fetchManagerStock()
        }
    }, [user])

    const handleAddGold = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formWeight || parseFloat(formWeight) <= 0) {
            alert('Please enter a valid weight')
            return
        }

        try {
            setSubmitting(true)
            const token = localStorage.getItem('sessionToken')

            const response = await fetch('/api/manager-stock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    date: formDate,
                    karat: formKarat,
                    weight: parseFloat(formWeight),
                    description: formDescription
                })
            })

            if (response.ok) {
                alert('Gold added to manager stock successfully!')
                setFormWeight('')
                setFormDescription('')
                setShowAddForm(false)
                fetchManagerStock()
            } else {
                const error = await response.json()
                alert(`Failed to add gold: ${error.error}`)
            }
        } catch (error) {
            console.error('Error adding gold:', error)
            alert('Failed to add gold to manager stock')
        } finally {
            setSubmitting(false)
        }
    }

    const handleClearStock = async () => {
        if (!confirm('Are you sure you want to clear all manager stock? This will download the data and reset everything to zero.')) {
            return
        }

        try {
            setLoading(true)
            const token = localStorage.getItem('sessionToken')

            const response = await fetch('/api/manager-stock', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (response.ok) {
                const data = await response.json()

                // Download the data as JSON
                const dataStr = JSON.stringify(data.data, null, 2)
                const dataBlob = new Blob([dataStr], { type: 'application/json' })
                const url = URL.createObjectURL(dataBlob)
                const link = document.createElement('a')
                link.href = url
                link.download = `manager-stock-backup-${new Date().toISOString().split('T')[0]}.json`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)

                alert('Manager stock cleared and data downloaded successfully!')
                fetchManagerStock()
            } else {
                const error = await response.json()
                alert(`Failed to clear stock: ${error.error}`)
            }
        } catch (error) {
            console.error('Error clearing stock:', error)
            alert('Failed to clear manager stock')
        } finally {
            setLoading(false)
        }
    }

    const getStockByKarat = (karat: number): number => {
        if (!managerStock) return 0

        const karatKey = karat === 75.5 ? '755' : karat === 37.5 ? '375' : karat.toString()
        const stockField = `stock${karatKey}k` as keyof ManagerGoldStock
        return (managerStock[stockField] as number) || 0
    }

    const getEntriesByType = (type: 'ADMIN_TO_MANAGER' | 'MANAGER_TO_ADMIN') => {
        if (!managerStock) return []
        return managerStock.entries.filter(entry => entry.type === type)
    }

    if (loading && !managerStock) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Ezaz Ahmad - Gold Stock</h1>
                    <p className="text-gray-600 mt-1">Track gold transfers between Boss and Ezaz Ahmad</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                        {showAddForm ? 'Cancel' : 'Add Gold (Boss → Ezaz Ahmad)'}
                    </button>
                    <button
                        onClick={handleClearStock}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                        Clear & Download
                    </button>
                </div>
            </div>

            {/* Add Gold Form */}
            {showAddForm && (
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Gold to Ezaz Ahmad's Stock</h2>
                    <form onSubmit={handleAddGold} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Karat</label>
                                <select
                                    value={formKarat}
                                    onChange={(e) => setFormKarat(parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    {karatOptions.map(k => (
                                        <option key={k} value={k}>{k}K</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (grams)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formWeight}
                                    onChange={(e) => setFormWeight(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                            <textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="Add any notes about this transfer..."
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                        >
                            {submitting ? 'Adding...' : 'Add Gold'}
                        </button>
                    </form>
                </div>
            )}

            {/* Stock Summary by Karat */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Stock by Karat</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {karatOptions.map(karat => {
                        const stock = getStockByKarat(karat)
                        return (
                            <div key={karat} className="bg-gradient-to-r from-amber-400 to-yellow-500 p-4 rounded-lg text-white">
                                <h3 className="text-sm font-medium text-amber-100 uppercase tracking-wide">{karat}K Gold</h3>
                                <p className="mt-2 text-2xl font-bold">{stock.toFixed(2)}g</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Two Stock Sections Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Admin to Manager (Manual Entries) */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">Boss → Ezaz Ahmad</h2>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            Manual Entry
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Gold given by Boss to Ezaz Ahmad (manually recorded)</p>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {getEntriesByType('ADMIN_TO_MANAGER').length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No entries yet</p>
                        ) : (
                            getEntriesByType('ADMIN_TO_MANAGER').map((entry, index) => (
                                <div key={entry.id || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-semibold text-gray-900">{entry.karat}K Gold</span>
                                            <span className="ml-2 text-2xl font-bold text-green-600">+{entry.weight.toFixed(2)}g</span>
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            {new Date(entry.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {entry.description && (
                                        <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Manager to Admin (Automatic from Orders) */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">Ezaz Ahmad → Boss</h2>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                            Auto from Orders
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Pure gold weight from completed orders (automatic)</p>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {getEntriesByType('MANAGER_TO_ADMIN').length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No completed orders yet</p>
                        ) : (
                            getEntriesByType('MANAGER_TO_ADMIN').map((entry, index) => (
                                <div key={entry.id || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-semibold text-gray-900">{entry.karat}K Gold</span>
                                            <span className="ml-2 text-2xl font-bold text-red-600">-{entry.weight.toFixed(2)}g</span>
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            {new Date(entry.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {entry.orderId && (
                                        <p className="text-sm text-gray-600 mt-1">Order: {entry.orderId}</p>
                                    )}
                                    {entry.description && (
                                        <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">How it works:</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li><strong>Boss → Ezaz Ahmad:</strong> Manually add gold entries when Boss gives gold to Ezaz Ahmad</li>
                    <li><strong>Ezaz Ahmad → Boss:</strong> Automatically updated when orders are completed (pure gold weight without stones)</li>
                    <li><strong>Stock by Karat:</strong> Each karat type is tracked separately</li>
                    <li><strong>Clear & Download:</strong> Downloads all data as JSON and resets stock to zero</li>
                </ul>
            </div>
        </div>
    )
}

export default ManagerPage
