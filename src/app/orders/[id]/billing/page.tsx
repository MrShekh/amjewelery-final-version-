import OrderBillingPage from '@/components/OrderBillingPage'

interface OrderBillingProps {
  params: Promise<{ id: string }>
}

export default async function OrderBilling({ params }: OrderBillingProps) {
  const { id } = await params
  return <OrderBillingPage orderId={id} />
}
