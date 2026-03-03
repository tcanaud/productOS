'use client';

import { useEffect, useRef } from 'react';
import { MermaidPreview } from '@/components/diagram/MermaidPreview';
import type { PatchAnimationEvent } from '@/lib/graphs/studio-session.types';

export type DiagramPreviewPanelProps = {
  diagramContent?: string;
  isStreaming?: boolean;
  patchAnimation?: PatchAnimationEvent;
};

export function DiagramPreviewPanel({
  diagramContent,
  isStreaming = false,
  patchAnimation,
}: DiagramPreviewPanelProps) {
  const hasContent = Boolean(diagramContent);
  const containerRef = useRef<HTMLDivElement>(null);

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
          <MermaidPreview content={diagramContent!} />
        </div>
      )}
    </div>
  );
}
