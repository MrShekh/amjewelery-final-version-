import OrderCompletePage from '@/components/OrderCompletePage'

interface CompleteOrderPageProps {
  params: Promise<{ id: string }>
}

export default async function CompleteOrderPage({ params }: CompleteOrderPageProps) {
  const { id } = await params
  return <OrderCompletePage orderId={id} />
}
