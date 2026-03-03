'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MermaidPreview } from '@/components/diagram/MermaidPreview';
import type { ClickPosition } from '@/components/diagram/MermaidPreview';
import { DiagramContextMenu } from '@/components/diagram/DiagramContextMenu';
import type { DiagramAction } from '@/components/diagram/DiagramContextMenu';
import type { PatchAnimationEvent } from '@/lib/graphs/studio-session.types';
import type { JsonGraph } from '@/lib/json2mermaid/types';

type ContextMenuState =
  | { type: 'node'; nodeId: string; position: ClickPosition }
  | { type: 'edge'; edgeFrom: string; edgeTo: string; position: ClickPosition }
  | null;

export type DiagramPreviewPanelProps = {
  diagramContent?: string;
  isStreaming?: boolean;
  patchAnimation?: PatchAnimationEvent;
  /** Structured graph powering the diagram — forwarded to MermaidPreview for patch animations. */
  graph?: JsonGraph;
  /** Called when the user selects an action from the context menu. */
  onDiagramAction?: (action: DiagramAction) => void;
};

export function DiagramPreviewPanel({
  diagramContent,
  isStreaming = false,
  patchAnimation,
  graph,
  onDiagramAction,
}: DiagramPreviewPanelProps) {
  const hasContent = Boolean(diagramContent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  const handleNodeClick = useCallback((nodeId: string, pos: ClickPosition) => {
    setContextMenu({ type: 'node', nodeId, position: pos });
  }, []);

  const handleEdgeClick = useCallback(
    (_edgeId: string, pos: ClickPosition, from: string, to: string) => {
      setContextMenu({ type: 'edge', edgeFrom: from, edgeTo: to, position: pos });
    },
    []
  );

  const handleAction = useCallback(
    (action: DiagramAction) => {
      onDiagramAction?.(action);
    },
    [onDiagramAction]
  );

  const closeMenu = useCallback(() => setContextMenu(null), []);

  // Apply patch animation classes to the diagram container when a patch is applied
  useEffect(() => {
    if (!patchAnimation || !containerRef.current) return;

    const el = containerRef.current;
    const cssClass =
      patchAnimation.type === 'add'
        ? 'patch-add-highlight'
        : patchAnimation.type === 'remove'
          ? 'patch-remove-fade'
          : 'patch-modify-pulse';

    el.classList.add(cssClass);

    const duration =
      patchAnimation.type === 'remove' ? 400 : patchAnimation.type === 'modify' ? 500 : 600;
    const timer = setTimeout(() => {
      el.classList.remove(cssClass);
    }, duration);

    return () => {
      clearTimeout(timer);
      el.classList.remove(cssClass);
    };
  }, [patchAnimation]);

  return (
    <div className="relative flex h-full items-stretch p-6">
      {/* Placeholder — shown when there is no diagram yet and not streaming */}
      {!hasContent && !isStreaming && (
        <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-border">
          <p className="text-sm text-muted-foreground">Your diagram will appear here</p>
        </div>
      )}

      {/* Shimmer skeleton — shown while streaming */}
      {isStreaming && (
        <div
          className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-border"
          aria-busy="true"
          aria-label="Generating diagram…"
        >
          <div className="w-full space-y-3 px-8">
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-4 animate-pulse rounded bg-muted" style={{ width: '75%' }} />
            <div className="h-4 animate-pulse rounded bg-muted" style={{ width: '60%' }} />
            <div className="h-4 animate-pulse rounded bg-muted" style={{ width: '80%' }} />
          </div>
        </div>
      )}

      {/* Mermaid preview — fades in when content arrives; animated on patch update */}
      {hasContent && !isStreaming && (
        <div
          ref={containerRef}
          className="h-full w-full rounded-lg border border-border overflow-hidden transition-opacity duration-300"
          style={{ opacity: 1 }}
        >
          <MermaidPreview
            content={diagramContent!}
            graph={graph}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
          />
        </div>
      )}

      {/* Context menu — rendered when a node or edge is clicked */}
      {contextMenu?.type === 'node' && (
        <DiagramContextMenu
          type="node"
          nodeId={contextMenu.nodeId}
          position={contextMenu.position}
          onAction={handleAction}
          onClose={closeMenu}
        />
      )}
      {contextMenu?.type === 'edge' && (
        <DiagramContextMenu
          type="edge"
          edgeFrom={contextMenu.edgeFrom}
          edgeTo={contextMenu.edgeTo}
          position={contextMenu.position}
          onAction={handleAction}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
