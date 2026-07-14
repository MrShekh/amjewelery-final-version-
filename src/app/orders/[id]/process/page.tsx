import OrderProcessPage from '@/components/OrderProcessPage'

export default async function OrderProcess({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderProcessPage orderId={id} />
}
