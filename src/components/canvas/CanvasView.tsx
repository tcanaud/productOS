'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useCanvasViewport } from '@/hooks/useCanvasViewport';
import { ArtifactCard } from './ArtifactCard';
import { ConnectionLayer } from './ConnectionLayer';
import type { CanvasArtifact, CanvasConnection, CanvasState } from '@/lib/canvas/types';

interface CanvasViewProps {
  workspaceId: string;
}

/**
 * CanvasView — Story 8.2
 *
 * Infinite canvas that renders all workspace CanvasArtifact cards at their
 * stored positions. Supports pan (pointer drag on blank area or scroll),
 * zoom (Ctrl+scroll / trackpad pinch), and artifact drag with persistence.
 */
export function CanvasView({ workspaceId }: CanvasViewProps) {
  const [canvasState, setCanvasState] = useState<CanvasState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { viewportRef, zoom, isPanning, worldTransform, handlers } = useCanvasViewport();

  // Fetch canvas state on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/canvas`);
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = (await res.json()) as CanvasState;
        if (!cancelled) {
          setCanvasState(data);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load canvas';
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Optimistic artifact move + fire-and-forget PATCH
  const handleArtifactMove = useCallback(
    (artifactId: string, x: number, y: number) => {
      // Optimistic update
      setCanvasState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          artifacts: prev.artifacts.map((a) =>
            a.id === artifactId ? { ...a, position: { ...a.position, x, y } } : a
          ),
        };
      });

      // Fire-and-forget persist
      fetch(`/api/workspaces/${workspaceId}/canvas/artifacts/${artifactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      }).catch(() => {
        toast.error('Failed to save position — drag again to retry');
      });
    },
    [workspaceId]
  );

  const handleDragEnd = useCallback(
    (artifactId: string, x: number, y: number) => {
      handleArtifactMove(artifactId, x, y);
    },
    [handleArtifactMove]
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const artifacts: CanvasArtifact[] = canvasState?.artifacts ?? [];
  const connections: CanvasConnection[] = canvasState?.connections ?? [];

  return (
    <div
      ref={viewportRef}
      className={`relative w-full h-full overflow-hidden bg-muted/30 ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      {...handlers}
    >
      {/* Dot grid background — purely decorative */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${(canvasState ? 0 : 0) + 0}px ${0}px`,
        }}
        aria-hidden="true"
      />

      {/* World — scaled and translated */}
      <div
        className="absolute"
        style={{
          transform: worldTransform,
          transformOrigin: '0 0',
          width: 0,
          height: 0,
        }}
      >
        {/* Connection lines rendered below artifact cards */}
        <ConnectionLayer connections={connections} artifacts={artifacts} zoom={zoom} />
        {artifacts.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            zoom={zoom}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Empty state */}
      {artifacts.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground">No artifacts on this canvas yet</p>
        </div>
      )}
    </div>
  );
}
