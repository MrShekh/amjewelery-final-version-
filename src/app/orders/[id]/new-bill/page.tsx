import NewBillCreator from '@/components/NewBillCreator'

interface NewBillPageProps {
  params: Promise<{ id: string }>
}

export default async function NewBillPage({ params }: NewBillPageProps) {
  const { id } = await params
  return <NewBillCreator orderId={id} />
}
