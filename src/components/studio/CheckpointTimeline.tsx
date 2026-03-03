'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CheckpointNode } from '@/hooks/useCheckpointTree';

interface CheckpointTimelineProps {
  tree: CheckpointNode[];
  headId: string | null;
  activeBranch: string;
  onRestore: (checkpointId: string) => void;
  onFork: (checkpointId: string) => void;
}

/**
 * Compact horizontal timeline showing checkpoint nodes with branching support.
 * Click to restore, right-click to fork.
 */
export function CheckpointTimeline({
  tree,
  headId,
  activeBranch,
  onRestore,
  onFork,
}: CheckpointTimelineProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    checkpointId: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group nodes by branch
  const branches = new Map<string, CheckpointNode[]>();
  for (const node of tree) {
    const list = branches.get(node.branchName) ?? [];
    list.push(node);
    branches.set(node.branchName, list);
  }

  // Sort branches: active branch first, then "main", then alphabetical
  const sortedBranchNames = Array.from(branches.keys()).sort((a, b) => {
    if (a === activeBranch) return -1;
    if (b === activeBranch) return 1;
    if (a === 'main') return -1;
    if (b === 'main') return 1;
    return a.localeCompare(b);
  });

  // Close context menu on click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('click', handleClose);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClose);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  // Auto-scroll to head node
  useEffect(() => {
    if (!headId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-cp-id="${headId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [headId]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, checkpointId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, checkpointId });
    },
    []
  );

  if (tree.length === 0) return null;

  return (
    <div className="relative">
      <div ref={scrollRef} className="overflow-x-auto px-3 py-2">
        {sortedBranchNames.map((branchName) => {
          const nodes = branches.get(branchName) ?? [];
          if (nodes.length === 0) return null;

          return (
            <div key={branchName} className="flex items-center gap-1 mb-1 last:mb-0">
              {/* Branch label */}
              <span
                className={`text-[10px] font-medium w-14 shrink-0 truncate ${
                  branchName === activeBranch
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
                title={branchName}
              >
                {branchName}
              </span>

              {/* Nodes in this branch */}
              <div className="flex items-center gap-0.5">
                {nodes.map((node, idx) => {
                  const isCurrent = node.id === headId;
                  const truncatedMsg =
                    node.userMessage.length > 30
                      ? node.userMessage.slice(0, 30) + '...'
                      : node.userMessage;

                  return (
                    <div key={node.id} className="flex items-center">
                      {/* Connector line */}
                      {idx > 0 && (
                        <div
                          className={`w-3 h-px ${
                            branchName === activeBranch
                              ? 'bg-foreground/30'
                              : 'bg-muted-foreground/20'
                          }`}
                        />
                      )}

                      {/* Node dot */}
                      <button
                        data-cp-id={node.id}
                        onClick={() => onRestore(node.id)}
                        onContextMenu={(e) => handleContextMenu(e, node.id)}
                        title={`Turn ${node.turnNumber}: ${truncatedMsg}`}
                        className={`
                          relative flex items-center justify-center
                          w-6 h-6 rounded-full text-[10px] font-mono
                          transition-all duration-150 cursor-pointer
                          ${
                            isCurrent
                              ? 'bg-foreground text-background ring-2 ring-foreground/30 scale-110'
                              : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20 hover:scale-105'
                          }
                        `}
                      >
                        {node.turnNumber}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              onRestore(contextMenu.checkpointId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            Restore here
          </button>
          <button
            onClick={() => {
              onFork(contextMenu.checkpointId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            Fork from here
          </button>
        </div>
      )}
    </div>
  );
}
