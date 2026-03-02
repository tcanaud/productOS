'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WorkspaceCardData } from './WorkspaceCard';

type WorkspaceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: WorkspaceCardData | null; // null = create mode
  onSuccess: (workspace: WorkspaceCardData) => void;
};

export function WorkspaceFormDialog({
  open,
  onOpenChange,
  workspace,
  onSuccess,
}: WorkspaceFormDialogProps) {
  const isEdit = workspace != null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(workspace?.name ?? '');
      setDescription(workspace?.description ?? '');
    }
  }, [open, workspace]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const url = isEdit ? `/api/workspaces/${workspace!.id}` : '/api/workspaces';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? 'Something went wrong');
        return;
      }
      const saved = (await res.json()) as WorkspaceCardData;
      toast.success(isEdit ? 'Workspace updated' : 'Workspace created');
      onSuccess(saved);
      onOpenChange(false);
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Workspace' : 'New Workspace'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Name *</Label>
            <Input
              id="ws-name"
              placeholder="My Product Workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-description">Description</Label>
            <Textarea
              id="ws-description"
              placeholder="What is this workspace for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
