import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GitBranch } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-utils';
import { NewDiagramButton } from '@/components/diagram/NewDiagramButton';

type PageProps = { params: Promise<{ id: string }> };

export default async function DiagramsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const diagrams = await prisma.diagram.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, diagramType: true, updatedAt: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Diagrams</h1>
        <NewDiagramButton workspaceId={workspaceId} />
      </div>

      {diagrams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GitBranch className="mb-4 h-10 w-10 text-muted-foreground/50" />
          <h2 className="text-base font-medium">No diagrams yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new diagram to start modeling your product flows.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {diagrams.map((d) => (
            <Link
              key={d.id}
              href={`/workspaces/${workspaceId}/diagrams/${d.id}`}
              className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{d.title}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">{d.diagramType}</span>
                <span>{new Date(d.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
