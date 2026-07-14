import OrderDetailPage from '@/components/OrderDetailPage'

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetailPage orderId={id} />
}
