import OrderBillPage from '@/components/OrderBillPage'

interface BillPageProps {
  params: Promise<{ id: string }>
}

export default async function BillPage({ params }: BillPageProps) {
  const { id } = await params
  return <OrderBillPage orderId={id} />
}
