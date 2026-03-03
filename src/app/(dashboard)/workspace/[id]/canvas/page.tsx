import { CanvasView } from '@/components/canvas/CanvasView';

interface CanvasPageProps {
  params: Promise<{ id: string }>;
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { id } = await params;
  return (
    <div className="h-full overflow-hidden">
      <CanvasView workspaceId={id} />
    </div>
  );
}
