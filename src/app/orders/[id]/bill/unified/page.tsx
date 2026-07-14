import UnifiedOrderBillPage from '@/components/UnifiedOrderBillPage'

interface UnifiedOrderBillRouteProps {
  params: Promise<{ id: string }>
}

export default async function UnifiedOrderBillRoute({ params }: UnifiedOrderBillRouteProps) {
  const { id } = await params

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <UnifiedOrderBillPage orderId={id} />
    </div>
  )
}
