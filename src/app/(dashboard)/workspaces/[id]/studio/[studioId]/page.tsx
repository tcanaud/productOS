import { StudioLayout } from '@/components/studio/StudioLayout';

interface StudioSessionPageProps {
  params: Promise<{ id: string; studioId: string }>;
}

export default async function StudioSessionPage({ params }: StudioSessionPageProps) {
  const { id, studioId } = await params;
  return (
    <div className="h-full">
      <StudioLayout workspaceId={id} studioId={studioId} />
    </div>
  );
}
