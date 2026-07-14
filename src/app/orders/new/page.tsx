import { Suspense } from 'react'
import NewOrderPage from '@/components/NewOrderPage'

function NewOrderPageContent() {
  return <NewOrderPage />
}

export default function NewOrder() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewOrderPageContent />
    </Suspense>
  )
}
