'use client'

import React from 'react'

// Skeleton loader for cards/sections
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white p-6 rounded-lg shadow-md animate-pulse ${className}`}>
    <div className="h-4 bg-gray-200 rounded mb-3 w-1/3"></div>
    <div className="space-y-2">
      <div className="h-3 bg-gray-200 rounded w-full"></div>
      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
    </div>
  </div>
)

// Skeleton for form fields
export const SkeletonFormField: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded mb-2 w-1/4"></div>
    <div className="h-10 bg-gray-200 rounded w-full"></div>
  </div>
)

// Skeleton for table rows
export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 4 }) => (
  <tr className="animate-pulse">
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index} className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded"></div>
      </td>
    ))}
  </tr>
)

// Loading spinner (for when skeleton isn't appropriate)
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg', className?: string }> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}></div>
    </div>
  )
}

// Loading overlay for forms/modals
export const LoadingOverlay: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-3">
      <LoadingSpinner size="md" />
      <span className="text-gray-700 font-medium">{message}</span>
    </div>
  </div>
)

// Page-level loading state
export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Loading page...' }) => (
  <div className="flex flex-col items-center justify-center h-64">
    <LoadingSpinner size="lg" className="mb-4" />
    <p className="text-gray-600 text-lg">{message}</p>
  </div>
)

// Advanced skeleton for billing sections
export const BillingFormSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="bg-gray-50 p-4 rounded-lg animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-3 w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonFormField />
        <SkeletonFormField />
      </div>
    </div>

    {/* Calculation Section Skeleton */}
    <div className="bg-blue-50 p-4 rounded-lg animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-3 w-1/2"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SkeletonFormField />
        <SkeletonFormField />
        <SkeletonFormField />
        <SkeletonFormField />
      </div>
    </div>

    {/* Advance Gold Section Skeleton */}
    <div className="bg-purple-50 p-4 rounded-lg animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-3 w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonFormField />
        <SkeletonFormField />
        <SkeletonFormField />
      </div>
    </div>

    {/* Action Buttons Skeleton */}
    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
      <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
      <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
    </div>
  </div>
)

// Order summary skeleton
export const OrderSummarySkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-4 w-1/4"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  </div>
)

// Error boundary fallback with retry option
interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary?: () => void
  message?: string
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetErrorBoundary, 
  message = "Something went wrong" 
}) => (
  <div className="text-center py-12">
    <div className="mb-4">
      <span className="text-6xl">😕</span>
    </div>
    <h2 className="text-2xl font-semibold text-gray-900 mb-2">{message}</h2>
    <p className="text-gray-600 mb-4">{error.message}</p>
    {resetErrorBoundary && (
      <button
        onClick={resetErrorBoundary}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
      >
        Try Again
      </button>
    )}
  </div>
)
