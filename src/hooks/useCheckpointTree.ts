'use client';

import { useState, useCallback, useMemo } from 'react';
import type { StudioSessionState } from '@/lib/graphs/studio-session.types';

export interface CheckpointNode {
  id: string;
  parentId: string | null;
  branchName: string;
  turnNumber: number;
  userMessage: string;
  mermaidPreview: string | null;
  createdAt: string;
}

export interface RestoreResult {
  checkpoint: unknown;
  graphState: StudioSessionState;
  messageHistory: unknown[] | null;
  mermaidPreview: string | null;
  headCheckpointId: string;
  activeBranchName: string;
  turnNumber: number;
}

interface UseCheckpointTreeReturn {
  tree: CheckpointNode[];
  headId: string | null;
  activeBranch: string;
  turnNumber: number;
  loadTree: (workspaceId: string, studioId: string) => Promise<void>;
  trackTurn: (headCheckpointId: string, activeBranchName: string, turnNumber: number) => void;
  restore: (workspaceId: string, studioId: string, checkpointId: string) => Promise<RestoreResult | null>;
  fork: (workspaceId: string, studioId: string, checkpointId: string, title?: string) => Promise<{ studioId: string } | null>;
  canUndo: boolean;
  canRedo: boolean;
  undoId: string | null;
  redoId: string | null;
}

export function useCheckpointTree(): UseCheckpointTreeReturn {
  const [tree, setTree] = useState<CheckpointNode[]>([]);
  const [headId, setHeadId] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<string>('main');
  const [turnNumber, setTurnNumber] = useState<number>(0);

  const loadTree = useCallback(async (workspaceId: string, studioId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/studios/${studioId}/checkpoints`);
      if (!res.ok) return;
      const data = await res.json();
      setTree(data.tree ?? []);
      if (data.headCheckpointId) setHeadId(data.headCheckpointId);
      if (data.activeBranchName) setActiveBranch(data.activeBranchName);
      // Derive turnNumber from head checkpoint
      const headNode = (data.tree ?? []).find(
        (n: CheckpointNode) => n.id === data.headCheckpointId
      );
      if (headNode) setTurnNumber(headNode.turnNumber);
    } catch {
      // Best-effort load
    }
  }, []);

  const trackTurn = useCallback(
    (newHeadId: string, newBranch: string, newTurn: number) => {
      setHeadId(newHeadId);
      setActiveBranch(newBranch);
      setTurnNumber(newTurn);
      // Optimistically add to tree (will be replaced on next loadTree)
      setTree((prev) => {
        if (prev.some((n) => n.id === newHeadId)) return prev;
        // We don't have full data for this node, add a placeholder
        return [
          ...prev,
          {
            id: newHeadId,
            parentId: prev.length > 0 ? prev[prev.length - 1]?.id ?? null : null,
            branchName: newBranch,
            turnNumber: newTurn,
            userMessage: '',
            mermaidPreview: null,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    },
    []
  );

  const restore = useCallback(
    async (
      workspaceId: string,
      studioId: string,
      checkpointId: string
    ): Promise<RestoreResult | null> => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/studios/${studioId}/checkpoints/${checkpointId}/restore`,
          { method: 'POST' }
        );
        if (!res.ok) return null;
        const data = (await res.json()) as RestoreResult;
        setHeadId(data.headCheckpointId);
        setActiveBranch(data.activeBranchName);
        setTurnNumber(data.turnNumber);
        return data;
      } catch {
        return null;
      }
    },
    []
  );

  const fork = useCallback(
    async (
      workspaceId: string,
      studioId: string,
      checkpointId: string,
      title?: string
    ): Promise<{ studioId: string } | null> => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/studios/${studioId}/checkpoints/${checkpointId}/fork`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          }
        );
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    []
  );

  // Compute undo/redo targets from tree
  const { canUndo, canRedo, undoId, redoId } = useMemo(() => {
    if (!headId || tree.length === 0) {
      return { canUndo: false, canRedo: false, undoId: null, redoId: null };
    }

    const headNode = tree.find((n) => n.id === headId);
    const parentId = headNode?.parentId ?? null;

    // Redo: find first child of headId on the active branch
    const childOnBranch = tree.find(
      (n) => n.parentId === headId && n.branchName === activeBranch
    );

    return {
      canUndo: !!parentId,
      canRedo: !!childOnBranch,
      undoId: parentId,
      redoId: childOnBranch?.id ?? null,
    };
  }, [tree, headId, activeBranch]);

  return {
    tree,
    headId,
    activeBranch,
    turnNumber,
    loadTree,
    trackTurn,
    restore,
    fork,
    canUndo,
    canRedo,
    undoId,
    redoId,
  };
}
