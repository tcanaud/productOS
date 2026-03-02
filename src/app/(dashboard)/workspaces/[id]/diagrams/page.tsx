import { GitBranch } from 'lucide-react';

type PageProps = { params: Promise<{ id: string }> };

export default async function DiagramsPage({ params }: PageProps) {
  const { id } = await params;
  void id;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <GitBranch className="mb-4 h-10 w-10 text-muted-foreground/50" />
      <h2 className="text-base font-medium">Diagrams</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Flow diagrams and architecture charts will appear here.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Coming in Epic 2.</p>
    </div>
  );
}
