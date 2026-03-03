import { StudioLayout } from '@/components/studio/StudioLayout';

interface StudioPageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioPage({ params }: StudioPageProps) {
  const { id } = await params;
  return (
    <div className="h-full">
      <StudioLayout workspaceId={id} />
    </div>
  );
}
