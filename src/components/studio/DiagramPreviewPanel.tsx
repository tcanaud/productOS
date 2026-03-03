'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { MermaidPreview } from '@/components/diagram/MermaidPreview';
import type { ClickPosition } from '@/components/diagram/MermaidPreview';
import { DiagramContextMenu } from '@/components/diagram/DiagramContextMenu';
import type { DiagramAction } from '@/components/diagram/DiagramContextMenu';
import { ReviewBadgeDetail } from '@/components/diagram/ReviewBadgeDetail';
import { NodeChatModal } from '@/components/diagram/NodeChatModal';
import type { PatchAnimationEvent } from '@/lib/graphs/studio-session.types';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { Annotation } from '@/lib/ai/graphs/live-review.graph';

type ContextMenuState =
  | { type: 'node'; nodeId: string; position: ClickPosition }
  | { type: 'edge'; edgeFrom: string; edgeTo: string; position: ClickPosition }
  | null;

type ChatState = {
  nodeId: string;
  nodeLabel: string;
} | null;

export type DiagramPreviewPanelProps = {
  diagramContent?: string;
  isStreaming?: boolean;
  patchAnimation?: PatchAnimationEvent;
  /** Structured graph powering the diagram — forwarded to MermaidPreview for patch animations. */
  graph?: JsonGraph;
  /** Review annotations from the live-review graph — rendered as SVG badge overlays. */
  annotations?: Annotation[];
  /** Called when the user selects an action from the context menu. */
  onDiagramAction?: (action: DiagramAction) => void;
  /** Called when an AI node action produces an updated graph (expand / simplify). */
  onGraphUpdate?: (updatedGraph: JsonGraph) => void;
  /** Workspace ID — required for AI node actions. */
  workspaceId?: string;
};

export function DiagramPreviewPanel({
  diagramContent,
  isStreaming = false,
  patchAnimation,
  graph,
  annotations,
  onDiagramAction,
  onGraphUpdate,
  workspaceId,
}: DiagramPreviewPanelProps) {
  const hasContent = Boolean(diagramContent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [chatState, setChatState] = useState<ChatState>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
    async (action: DiagramAction) => {
      // Delegate non-AI actions to the parent immediately
      if (
        action.type !== 'expand-node' &&
        action.type !== 'simplify-node' &&
        action.type !== 'ask-node' &&
        action.type !== 'view-review'
      ) {
        onDiagramAction?.(action);
        return;
      }

      // Story 7.4 — AI-powered actions
      if (action.type === 'ask-node') {
        const nodeLabel = graph?.nodes.find((n) => n.id === action.nodeId)?.label ?? action.nodeId;
        setChatState({ nodeId: action.nodeId, nodeLabel });
        return;
      }

      if (action.type === 'view-review') {
        const annotation = annotations?.find((a) => a.nodeId === action.nodeId) ?? null;
        if (annotation) {
          setSelectedAnnotation(annotation);
        } else {
          toast.info('No review details available for this node');
        }
        return;
      }

      // expand-node / simplify-node — call AI API
      if (!graph || !workspaceId) {
        toast.error('Graph or workspace not available');
        return;
      }

      const endpoint =
        action.type === 'expand-node' ? '/api/ai/node/expand' : '/api/ai/node/simplify';

      setIsProcessing(true);
      const originalGraph = graph;

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, graph, nodeId: action.nodeId }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error ?? `Server error ${res.status}`);
        }

        const data = (await res.json()) as { graph: JsonGraph };
        onGraphUpdate?.(data.graph);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        toast.error(`Action failed: ${msg}`);
        // Restore original graph on error
        onGraphUpdate?.(originalGraph);
      } finally {
        setIsProcessing(false);
      }
    },
    [onDiagramAction, onGraphUpdate, graph, annotations, workspaceId]
  );

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const handleBadgeClick = useCallback((_nodeId: string, annotation: Annotation) => {
    setSelectedAnnotation(annotation);
  }, []);

  const closeDetail = useCallback(() => setSelectedAnnotation(null), []);
  const closeChat = useCallback(() => setChatState(null), []);

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
          className="relative h-full w-full rounded-lg border border-border overflow-hidden transition-opacity duration-300"
          style={{ opacity: 1 }}
        >
          <MermaidPreview
            content={diagramContent!}
            graph={graph}
            annotations={annotations}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onBadgeClick={handleBadgeClick}
          />

          {/* AI processing spinner overlay */}
          {isProcessing && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm"
              aria-label="Processing…"
              aria-busy="true"
            >
              <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 shadow-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-foreground">AI is processing…</span>
              </div>
            </div>
          )}
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
          annotations={annotations}
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

      {/* Review badge detail panel — rendered when a badge is clicked or "View review details" is selected */}
      {selectedAnnotation && (
        <ReviewBadgeDetail annotation={selectedAnnotation} onClose={closeDetail} />
      )}

      {/* Node chat modal — opened by "Ask a question about this node" */}
      {chatState && workspaceId && graph && (
        <NodeChatModal
          nodeId={chatState.nodeId}
          nodeLabel={chatState.nodeLabel}
          workspaceId={workspaceId}
          graph={graph}
          onClose={closeChat}
        />
      )}
    </div>
  );
}
