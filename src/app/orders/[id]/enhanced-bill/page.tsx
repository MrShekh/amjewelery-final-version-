import EnhancedOrderBillPage from '@/components/EnhancedOrderBillPage'

interface EnhancedBillPageProps {
  params: Promise<{ id: string }>
}

export default async function EnhancedBillPage({ params }: EnhancedBillPageProps) {
  const { id } = await params
  return <EnhancedOrderBillPage orderId={id} />
}
