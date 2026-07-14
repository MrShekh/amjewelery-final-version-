import BillDetailPage from '@/components/BillDetailPage'

interface BillPageProps {
  params: Promise<{ id: string }>
}

export default async function BillPage({ params }: BillPageProps) {
  const { id } = await params
  return <BillDetailPage billId={id} />
}
