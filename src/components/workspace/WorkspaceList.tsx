'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { WorkspaceCard, type WorkspaceCardData } from './WorkspaceCard';
import { WorkspaceFormDialog } from './WorkspaceFormDialog';

type WorkspaceListProps = {
  initialWorkspaces: WorkspaceCardData[];
};

export function WorkspaceList({ initialWorkspaces }: WorkspaceListProps) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceCardData[]>(initialWorkspaces);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkspaceCardData | null>(null);

  function openCreate() {
    setEditTarget(null);
    setDialogOpen(true);
  }

  function openEdit(workspace: WorkspaceCardData) {
    setEditTarget(workspace);
    setDialogOpen(true);
  }

  function handleSuccess(saved: WorkspaceCardData) {
    setWorkspaces((prev) => {
      const existing = prev.findIndex((w) => w.id === saved.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
    // Navigate to new workspace after creation
    if (!editTarget) {
      router.push(`/workspaces/${saved.id}/overview`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this workspace? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to delete workspace');
        return;
      }
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      toast.success('Workspace deleted');
    } catch {
      toast.error('Network error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product workspaces and artifacts.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Briefcase className="mb-4 h-10 w-10 text-muted-foreground/50" />
          <h2 className="text-base font-medium">No workspaces yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first workspace to get started.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Workspace
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <WorkspaceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspace={editTarget}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
