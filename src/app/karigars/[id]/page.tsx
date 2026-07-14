import SimpleKarigarRecovery from '@/components/SimpleKarigarRecovery'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function KarigarDetailPage({ params }: PageProps) {
  const { id } = await params
  return <SimpleKarigarRecovery karigarId={id} />
}
