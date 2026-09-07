'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface AdminGoldEntry {
    _id?: string
    id?: string
    date: Date | string
    karat: number
    weight: number // signed: positive = added, negative = removed
    type: 'MANUAL' | 'ORDER_COMPLETE' | 'ORDER_FILLING' | 'ORDER_DELETED' | 'KARIGAR_LOSS_RECOVERED' | 'CUSTOMER_GOLD_RECOVERED' | 'FINE_TO_KARAT'
    description?: string
    orderId?: string
    createdAt: Date | string
}

interface KaratBreakdownItem {
    karat: number
    weight: number
    fine: number
}

interface AdminGoldStock {
    id?: string
    entries: AdminGoldEntry[]
    breakdown: KaratBreakdownItem[]
    fineTotal: number
    fineStock?: number // Fine gold recovered directly from customers, not tied to a karat
    lastUpdated: Date | string
    createdAt: Date | string
}

const ENTRY_TYPE_LABELS: Record<AdminGoldEntry['type'], string> = {
    MANUAL: 'Manual',
    ORDER_COMPLETE: 'Auto from Order',
    ORDER_FILLING: 'Filling In (Order)',
    ORDER_DELETED: 'Order Deleted (Returned)',
    KARIGAR_LOSS_RECOVERED: 'Recovered from Karigar Loss',
    CUSTOMER_GOLD_RECOVERED: 'Recovered from Customer',
    FINE_TO_KARAT: 'Fine → Karat Conversion'
}

const KARAT_OPTIONS = [92, 88, 84, 80, 76, 75.5, 75, 59, 37.5]

const AdminStockPage = () => {
    const { user } = useAuth()
    const [adminStock, setAdminStock] = useState<AdminGoldStock | null>(null)
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)
    const [showConvertForm, setShowConvertForm] = useState(false)

    const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])
    const [formKarat, setFormKarat] = useState<number>(92)
    const [formWeight, setFormWeight] = useState<string>('')
    const [formDirection, setFormDirection] = useState<'ADD' | 'REMOVE'>('ADD')
    const [formDescription, setFormDescription] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)

    const [convertDate, setConvertDate] = useState(() => new Date().toISOString().split('T')[0])
    const [convertKarat, setConvertKarat] = useState<number>(92)
    const [convertFineAmount, setConvertFineAmount] = useState<string>('')
    const [convertDescription, setConvertDescription] = useState<string>('')
    const [converting, setConverting] = useState(false)

    const fetchAdminStock = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('sessionToken')
            const response = await fetch('/api/admin-stock', {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                setAdminStock(data.data)
            } else {
                console.error('Failed to fetch admin stock')
            }
        } catch (error) {
            console.error('Error fetching admin stock:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user) {
            fetchAdminStock()
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

            const response = await fetch('/api/admin-stock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    date: formDate,
                    karat: formKarat,
                    weight: parseFloat(formWeight),
                    direction: formDirection,
                    description: formDescription
                })
            })

            if (response.ok) {
                setFormWeight('')
                setFormDescription('')
                setShowAddForm(false)
                fetchAdminStock()
            } else {
                const error = await response.json()
                alert(`Failed to update admin stock: ${error.error}`)
            }
        } catch (error) {
            console.error('Error updating admin stock:', error)
            alert('Failed to update admin stock')
        } finally {
            setSubmitting(false)
        }
    }

    const handleConvertFineToKarat = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!convertFineAmount || parseFloat(convertFineAmount) <= 0) {
            alert('Please enter a valid Fine amount to convert')
            return
        }

        try {
            setConverting(true)
            const token = localStorage.getItem('sessionToken')

            const response = await fetch('/api/admin-stock/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    date: convertDate,
                    karat: convertKarat,
                    fineAmount: parseFloat(convertFineAmount),
                    description: convertDescription
                })
            })

            if (response.ok) {
                const data = await response.json()
                setConvertFineAmount('')
                setConvertDescription('')
                setShowConvertForm(false)
                fetchAdminStock()
                alert(data.message)
            } else {
                const error = await response.json()
                alert(`Failed to convert: ${error.error}`)
            }
        } catch (error) {
            console.error('Error converting fine to karat:', error)
            alert('Failed to convert fine gold')
        } finally {
            setConverting(false)
        }
    }

    const getBreakdown = (karat: number): KaratBreakdownItem => {
        return adminStock?.breakdown.find(b => b.karat === karat) || { karat, weight: 0, fine: 0 }
    }

    if (loading && !adminStock) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    const sortedEntries = [...(adminStock?.entries || [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Admin Stock</h1>
                    <p className="text-gray-600 mt-1">Karat-wise gold on hand, converted to fine gold</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setShowConvertForm(false); setShowAddForm(!showAddForm) }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                        {showAddForm ? 'Cancel' : 'Add / Remove Gold'}
                    </button>
                    <button
                        onClick={() => { setShowAddForm(false); setShowConvertForm(!showConvertForm) }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                        {showConvertForm ? 'Cancel' : 'Convert Fine → Karat'}
                    </button>
                </div>
            </div>

            {/* Fine Total */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-lg text-white">
                <h2 className="text-lg font-semibold mb-1">Total Admin Stock (Fine Gold)</h2>
                <p className="text-4xl font-bold">{(adminStock?.fineTotal ?? 0).toFixed(3)}g</p>
                <p className="text-green-100 mt-2 text-sm">Sum of every karat below, converted to fine, plus direct fine gold (manual + recovered from customers)</p>
            </div>

            {/* Direct Fine Gold (manual additions + recovered from customers) */}
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-6 rounded-lg text-white">
                <h2 className="text-lg font-semibold mb-1">Fine Gold (Direct)</h2>
                <p className="text-3xl font-bold">{(adminStock?.fineStock ?? 0).toFixed(3)}g</p>
                <p className="text-sky-100 mt-2 text-sm">Not tied to any karat — added directly as fine, or recovered back from customers</p>
            </div>

            {/* Add / Remove Gold Form */}
            {showAddForm && (
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Add or Remove Gold</h2>
                    <form onSubmit={handleAddGold} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Karat (Purity)</label>
                                <select
                                    value={formKarat}
                                    onChange={(e) => setFormKarat(parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value={0}>Fine (direct, not tied to a karat)</option>
                                    {KARAT_OPTIONS.map(k => (
                                        <option key={k} value={k}>{k}%</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                                <select
                                    value={formDirection}
                                    onChange={(e) => setFormDirection(e.target.value as 'ADD' | 'REMOVE')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="ADD">Add (+)</option>
                                    <option value="REMOVE">Remove (-)</option>
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
                                placeholder="e.g., Given to karigar for work, Purchased, Opening balance..."
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : 'Save'}
                        </button>
                    </form>
                </div>
            )}

            {/* Convert Fine to Karat Form */}
            {showConvertForm && (
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Convert Fine Gold to Karat</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Alloys pure Fine Gold down to a specific karat. Fine Stock goes down by the amount you convert;
                        that karat's stock goes up by the equivalent karat weight (more grams, since it's diluted — the fine content stays the same).
                    </p>
                    <form onSubmit={handleConvertFineToKarat} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={convertDate}
                                    onChange={(e) => setConvertDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target Karat</label>
                                <select
                                    value={convertKarat}
                                    onChange={(e) => setConvertKarat(parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                >
                                    {KARAT_OPTIONS.map(k => (
                                        <option key={k} value={k}>{k}%</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fine Amount to Convert (grams)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={convertFineAmount}
                                    onChange={(e) => setConvertFineAmount(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>

                        {convertFineAmount && !isNaN(parseFloat(convertFineAmount)) && (
                            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
                                {parseFloat(convertFineAmount).toFixed(3)}g Fine → {(parseFloat(convertFineAmount) / (convertKarat / 100)).toFixed(3)}g of {convertKarat}K gold
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                            <textarea
                                value={convertDescription}
                                onChange={(e) => setConvertDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                rows={2}
                                placeholder="e.g., Alloyed for order batch..."
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={converting}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                        >
                            {converting ? 'Converting...' : 'Convert'}
                        </button>
                    </form>
                </div>
            )}

            {/* Stock by Karat */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Stock by Karat</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {KARAT_OPTIONS.map(karat => {
                        const b = getBreakdown(karat)
                        return (
                            <div key={karat} className="bg-gradient-to-r from-amber-400 to-yellow-500 p-4 rounded-lg text-white">
                                <h3 className="text-sm font-medium text-amber-100 uppercase tracking-wide">{karat}% Gold</h3>
                                <p className="mt-2 text-2xl font-bold">{b.weight.toFixed(2)}g</p>
                                <p className="text-xs text-amber-100 mt-1">Fine: {b.fine.toFixed(2)}g</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Entry History */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Entry History</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {sortedEntries.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No entries yet</p>
                    ) : (
                        sortedEntries.map((entry, index) => (
                            <div key={entry.id || entry._id || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900">{entry.karat > 0 ? `${entry.karat}% Gold` : 'Fine Gold'}</span>
                                        <span className={`text-2xl font-bold ${entry.weight >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {entry.weight >= 0 ? '+' : ''}{entry.weight.toFixed(2)}g
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${entry.type === 'MANUAL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                            {ENTRY_TYPE_LABELS[entry.type] || entry.type}
                                        </span>
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

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">How it works:</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Add gold whenever it comes in (purchase, opening balance) or goes out (given for work) for a specific karat</li>
                    <li>When an order is completed, the pure gold weight used is automatically deducted from that order's karat</li>
                    <li>Each karat is tracked separately in karat-gold weight; the total shown at the top is the fine-gold equivalent</li>
                    <li>Stock can go negative if more gold has been given out than recorded as added</li>
                    <li>Use &quot;Convert Fine → Karat&quot; to alloy pure Fine Gold into a specific karat — this needs enough Fine Gold on hand and won&apos;t go negative</li>
                </ul>
            </div>
        </div>
    )
}

export default AdminStockPage
