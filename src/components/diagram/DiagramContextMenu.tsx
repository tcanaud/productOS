'use client';

/**
 * DiagramContextMenu — Story 7.1 / Story 7.4
 *
 * Floating context menu anchored to the click position on a diagram node or edge.
 * Closes on Escape key or outside click (via a full-screen backdrop).
 */
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Annotation } from '@/lib/ai/graphs/live-review.graph';

/** All possible diagram interactions dispatched from the context menu. */
export type DiagramAction =
  | { type: 'rename'; nodeId: string }
  | { type: 'add-child'; nodeId: string }
  | { type: 'add-parent'; nodeId: string }
  | { type: 'remove-node'; nodeId: string }
  | { type: 'explain-node'; nodeId: string }
  | { type: 'add-condition'; from: string; to: string }
  | { type: 'remove-connection'; from: string; to: string }
  | { type: 'reverse-direction'; from: string; to: string }
  // Story 7.4 — AI-powered node actions
  | { type: 'expand-node'; nodeId: string }
  | { type: 'ask-node'; nodeId: string }
  | { type: 'simplify-node'; nodeId: string }
  | { type: 'view-review'; nodeId: string }
  // Story 9.3 — Layer navigation
  | { type: 'zoom-into-layer'; nodeId: string; childGraphId: string };

type NodeMenuProps = {
  type: 'node';
  nodeId: string;
  position: { x: number; y: number };
  onAction: (action: DiagramAction) => void;
  onClose: () => void;
  /** Review annotations — used to show/hide the "View review details" item. */
  annotations?: Annotation[];
  /** If set, the node is composite and this is its child layer ID (Story 9.3). */
  childGraphId?: string;
};

type EdgeMenuProps = {
  type: 'edge';
  edgeFrom: string;
  edgeTo: string;
  position: { x: number; y: number };
  onAction: (action: DiagramAction) => void;
  onClose: () => void;
};

export type DiagramContextMenuProps = NodeMenuProps | EdgeMenuProps;

/** Separator between menu sections. */
function MenuSeparator() {
  return <div className="my-1 border-t" />;
}

/** Individual menu item button. */
function MenuItem({
  label,
  onClick,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'w-full justify-start rounded-none px-3 py-1.5 text-sm font-normal',
        destructive && 'text-destructive hover:text-destructive'
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export function DiagramContextMenu(props: DiagramContextMenuProps) {
  const { position, onAction, onClose } = props;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAction = (action: DiagramAction) => {
    onAction(action);
    onClose();
  };

  return (
    <>
      {/* Transparent full-screen backdrop — outside click closes menu */}
      <div
        className="fixed inset-0 z-40"
        aria-hidden="true"
        onClick={onClose}
        data-testid="context-menu-backdrop"
      />

      {/* Context menu card */}
      <div
        className="fixed z-50 min-w-[180px] overflow-hidden rounded-md border bg-popover shadow-md"
        style={{ left: position.x, top: position.y }}
        role="menu"
        aria-label={props.type === 'node' ? 'Node actions' : 'Edge actions'}
        data-testid="diagram-context-menu"
      >
        {props.type === 'node' && (
          <div className="flex flex-col py-1">
            {/* Story 9.3 — Layer navigation (composite nodes only) */}
            {props.childGraphId && (
              <>
                <MenuItem
                  label="Zoom into layer"
                  onClick={() =>
                    handleAction({
                      type: 'zoom-into-layer',
                      nodeId: props.nodeId,
                      childGraphId: props.childGraphId!,
                    })
                  }
                />
                <MenuSeparator />
              </>
            )}
            {/* Story 7.4 — AI-powered actions */}
            <MenuItem
              label="Expand into sub-flow"
              onClick={() => handleAction({ type: 'expand-node', nodeId: props.nodeId })}
            />
            <MenuItem
              label="Simplify"
              onClick={() => handleAction({ type: 'simplify-node', nodeId: props.nodeId })}
            />
            <MenuItem
              label="Ask a question about this node"
              onClick={() => handleAction({ type: 'ask-node', nodeId: props.nodeId })}
            />
            <MenuItem
              label="View review details"
              onClick={() => handleAction({ type: 'view-review', nodeId: props.nodeId })}
            />
            <MenuSeparator />
            {/* Story 7.1 — structural actions */}
            <MenuItem
              label="Explain node"
              onClick={() => handleAction({ type: 'explain-node', nodeId: props.nodeId })}
            />
            <MenuItem
              label="Rename"
              onClick={() => handleAction({ type: 'rename', nodeId: props.nodeId })}
            />
            <MenuItem
              label="Add child node"
              onClick={() => handleAction({ type: 'add-child', nodeId: props.nodeId })}
            />
            <MenuItem
              label="Add parent node"
              onClick={() => handleAction({ type: 'add-parent', nodeId: props.nodeId })}
            />
            <MenuSeparator />
            <MenuItem
              label="Remove node"
              destructive
              onClick={() => handleAction({ type: 'remove-node', nodeId: props.nodeId })}
            />
          </div>
        )}

        {props.type === 'edge' && (
          <div className="flex flex-col py-1">
            <MenuItem
              label="Add condition"
              onClick={() =>
                handleAction({ type: 'add-condition', from: props.edgeFrom, to: props.edgeTo })
              }
            />
            <MenuItem
              label="Reverse direction"
              onClick={() =>
                handleAction({
                  type: 'reverse-direction',
                  from: props.edgeFrom,
                  to: props.edgeTo,
                })
              }
            />
            <div className="my-1 border-t" />
            <MenuItem
              label="Remove connection"
              destructive
              onClick={() =>
                handleAction({
                  type: 'remove-connection',
                  from: props.edgeFrom,
                  to: props.edgeTo,
                })
              }
            />
          </div>
        )}
      </div>
    </>
  );
}
