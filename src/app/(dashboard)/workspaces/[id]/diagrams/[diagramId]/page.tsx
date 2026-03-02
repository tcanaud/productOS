import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-utils';
import { DiagramEditorLayout } from '@/components/diagram/DiagramEditorLayout';

type PageProps = { params: Promise<{ id: string; diagramId: string }> };

export default async function DiagramEditorPage({ params }: PageProps) {
  const { id: workspaceId, diagramId } = await params;

  const user = await getCurrentUser();
  if (!user) notFound();

  const diagram = await prisma.diagram.findFirst({
    where: {
      id: diagramId,
      workspaceId,
      workspace: { members: { some: { userId: user.id } } },
    },
  });

  if (!diagram) notFound();

  return (
    <div className="flex h-full flex-col">
      <DiagramEditorLayout
        diagramId={diagram.id}
        initialContent={diagram.content}
        initialTitle={diagram.title}
      />
    </div>
  );
}
