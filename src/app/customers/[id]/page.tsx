import CustomerDetailPage from '@/components/CustomerDetailPage'

interface CustomerDetailProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetail({ params }: CustomerDetailProps) {
  const { id } = await params
  return <CustomerDetailPage customerId={id} />
}
