import KarigarWorkHistoryPage from '@/components/KarigarWorkHistoryPage'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WorkHistoryPage({ params }: PageProps) {
  const { id } = await params
  return <KarigarWorkHistoryPage karigarId={id} />
}
