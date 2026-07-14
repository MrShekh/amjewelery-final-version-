'use client'

import { useEffect, useState } from 'react'

interface ActivityItem {
  type: string
  id: string
  date: string
  title: string
  details: {
    // Order details
    customerName?: string
    orderType?: string
    goldWeight?: number
    status?: string
    // Bill details  
    manufacturingCost?: number
    totalAmount?: number
    // Process details
    orderName?: string
    karigarName?: string
    inputWeight?: number
    outputWeight?: number
    goldLoss?: number
    // Casting details
    amount?: number
    type?: string
    description?: string
    recoveredGold?: number
    fineGoldTaken?: number
    karatGoldCast?: number
    fineGoldReturned?: number
    currentAdminStock?: number
  }
  icon: string
}

interface Summary {
  totalOrders: number
  totalBills: number
  totalManufacturingCharges: number
  totalProcesses: number
  casting: {
    totalGoldTaken: number
    totalActualCasting: number
    efficiency: string
    loss: number
  }
  dateRange: {
    filter: string
    startDate: string | null
    endDate: string | null
    generatedAt: string
  }
}

interface Pagination {
  currentPage: number
  totalPages: number
  totalActivities: number
  hasNextPage: boolean
  hasPrevPage: boolean
  limit: number
}

interface ActivityReportData {
  summary: Summary
  activities: ActivityItem[]
  pagination?: Pagination
  rawData: any
}

const ActivityReport = () => {
  const [data, setData] = useState<ActivityReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [dateFilter, setDateFilter] = useState('today')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [allActivities, setAllActivities] = useState<ActivityItem[]>([])

  const fetchActivityReport = async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setLoading(true)
        setAllActivities([])
      } else {
        setLoadingMore(true)
      }
      
      const sessionToken = localStorage.getItem('sessionToken')
      
      const params = new URLSearchParams({
        dateFilter,
        page: page.toString(),
        limit: '6',
        ...(dateFilter === 'custom' && customStartDate && customEndDate && {
          startDate: customStartDate,
          endDate: customEndDate
        })
      })

      const response = await fetch(`/api/reports/daily-activity?${params}`, {
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        }
      })

      if (response.ok) {
        const result = await response.json()
        const newData = result.success ? result.data : result
        
        if (append && data) {
          // Append new activities to existing ones
          const combinedActivities = [...allActivities, ...newData.activities]
          setAllActivities(combinedActivities)
          setData({
            ...data,
            activities: combinedActivities,
            pagination: newData.pagination
          })
        } else {
          // First load or refresh
          setAllActivities(newData.activities)
          setData(newData)
        }
        
        setCurrentPage(page)
      } else {
        console.error('Failed to fetch activity report')
      }
    } catch (error) {
      console.error('Error fetching activity report:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMoreActivities = () => {
    if (data?.pagination?.hasNextPage && !loadingMore) {
      fetchActivityReport(currentPage + 1, true)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
    fetchActivityReport(1, false)
  }, [dateFilter, customStartDate, customEndDate])

  const getFilterDisplayName = (filter: string) => {
    switch (filter) {
      case 'today': return 'Today'
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      case 'year': return 'This Year'
      case 'custom': return 'Custom Range'
      default: return 'Unknown'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ORDER_CREATED': return '📦'
      case 'BILL_CREATED': return '💰'
      case 'PROCESS_DONE': return '⚒️'
      case 'CASTING_ACTIVITY': return '🔥'
      default: return '📝'
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'ORDER_CREATED': return 'border-blue-200 bg-blue-50'
      case 'BILL_CREATED': return 'border-green-200 bg-green-50'
      case 'PROCESS_DONE': return 'border-orange-200 bg-orange-50'
      case 'CASTING_ACTIVITY': return 'border-red-200 bg-red-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">No data available</h2>
        <p className="text-gray-600 mt-2">Unable to load activity report</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Activity Report</h1>
          <p className="text-gray-600">
            {getFilterDisplayName(data.summary.dateRange.filter)}
            {data.summary.dateRange.startDate && data.summary.dateRange.endDate && (
              <span> ({new Date(data.summary.dateRange.startDate).toLocaleDateString()} - {new Date(data.summary.dateRange.endDate).toLocaleDateString()})</span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          {['today', 'week', 'month', 'year'].map(filter => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                dateFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {getFilterDisplayName(filter)}
            </button>
          ))}
          <button
            onClick={() => setDateFilter('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              dateFilter === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {dateFilter === 'custom' && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Orders Summary */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Orders Created</p>
              <p className="mt-2 text-3xl font-bold text-blue-900">{data.summary.totalOrders}</p>
            </div>
            <div className="text-4xl">📦</div>
          </div>
        </div>

        {/* Bills Summary */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 uppercase tracking-wide">Bills Created</p>
              <p className="mt-2 text-3xl font-bold text-green-900">{data.summary.totalBills}</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        {/* Manufacturing Charges Total */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600 uppercase tracking-wide">Making Charges Total</p>
              <p className="mt-2 text-3xl font-bold text-orange-900">{data.summary.totalManufacturingCharges.toFixed(3)}g</p>
            </div>
            <div className="text-4xl">🔨</div>
          </div>
        </div>

        {/* Processes Done */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 uppercase tracking-wide">Processes Done</p>
              <p className="mt-2 text-3xl font-bold text-purple-900">{data.summary.totalProcesses}</p>
            </div>
            <div className="text-4xl">⚒️</div>
          </div>
        </div>
      </div>


      {/* Activity Timeline */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Activity Timeline</h2>
        
        {data.activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 text-lg">No activities found for the selected period</p>
            <p className="text-gray-400 text-sm mt-2">Try selecting a different date range</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.activities.map((activity, index) => (
              <div
                key={`${activity.type}-${activity.id}-${index}`}
                className={`border rounded-lg p-4 ${getActivityColor(activity.type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">{activity.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDate(activity.date)}
                      </p>
                      
                      {/* Activity Details */}
                      <div className="mt-3 text-sm">
                        {activity.type === 'ORDER_CREATED' && (
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span><strong>Customer:</strong> {activity.details.customerName}</span>
                            <span><strong>Type:</strong> {activity.details.orderType}</span>
                            <span><strong>Gold:</strong> {(activity.details.goldWeight || 0).toFixed(3)}g</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              activity.details.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                              activity.details.status === 'IN_PROCESS' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {activity.details.status}
                            </span>
                          </div>
                        )}
                        
                        {activity.type === 'BILL_CREATED' && (
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span><strong>Customer:</strong> {activity.details.customerName}</span>
                            <span className="text-orange-600"><strong>Making Charges:</strong> {(activity.details.manufacturingCost || 0).toFixed(3)}g</span>
                            <span><strong>Total Amount:</strong> {activity.details.totalAmount?.toFixed(3) || '0.000'}g</span>
                          </div>
                        )}
                        
                        {activity.type === 'PROCESS_DONE' && (
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span><strong>Customer:</strong> {activity.details.customerName}</span>
                            <span><strong>Order:</strong> {activity.details.orderName}</span>
                            <span><strong>Karigar:</strong> {activity.details.karigarName}</span>
                            <span className="text-blue-600"><strong>In:</strong> {(activity.details.inputWeight || 0).toFixed(3)}g</span>
                            <span className="text-green-600"><strong>Out:</strong> {(activity.details.outputWeight || 0).toFixed(3)}g</span>
                            <span className="text-red-600"><strong>Loss:</strong> {(activity.details.goldLoss || 0).toFixed(3)}g</span>
                          </div>
                        )}
                        
                        {activity.type === 'CASTING_ACTIVITY' && (
                          <div className="text-sm">
                            <span>
                              <strong>Fine Gold Taken:</strong> -{activity.details.fineGoldTaken?.toFixed(3) || '0.000'}g, 
                              <strong>Karat Gold Cast:</strong> {activity.details.karatGoldCast?.toFixed(3) || '0.000'}g, 
                              <strong>Fine Gold Returned:</strong> +{activity.details.fineGoldReturned?.toFixed(3) || '0.000'}g, 
                              <strong>Admin Stock:</strong> {activity.details.currentAdminStock?.toFixed(3) || '0.000'}g
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    #{index + 1}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Load More Button */}
            {data.pagination && data.pagination.hasNextPage && (
              <div className="text-center pt-6">
                <button
                  onClick={loadMoreActivities}
                  disabled={loadingMore}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    loadingMore
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {loadingMore ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Loading...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <span>Load More Activities</span>
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  Showing {data.activities.length} of {data.pagination.totalActivities} activities
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        Report generated on {new Date(data.summary.dateRange.generatedAt).toLocaleString('en-IN')}
      </div>
    </div>
  )
}

export default ActivityReport
