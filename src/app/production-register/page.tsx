import ProductionRegisterPage from '@/components/ProductionRegisterPage'
import { Suspense } from 'react'

export default function ProductionRegister() {
  return (
    <div className="production-register-page min-h-screen bg-gray-50">
      <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading register...</div>}>
        <ProductionRegisterPage />
      </Suspense>
    </div>
  )
}
