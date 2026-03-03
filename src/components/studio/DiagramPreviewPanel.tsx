'use client';

import { MermaidPreview } from '@/components/diagram/MermaidPreview';

export type DiagramPreviewPanelProps = {
  diagramContent?: string;
  isStreaming?: boolean;
};

export function DiagramPreviewPanel({
  diagramContent,
  isStreaming = false,
}: DiagramPreviewPanelProps) {
  const hasContent = Boolean(diagramContent);

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

      {/* Mermaid preview — fades in when content arrives */}
      {hasContent && !isStreaming && (
        <div
          className="h-full w-full rounded-lg border border-border overflow-hidden transition-opacity duration-300"
          style={{ opacity: 1 }}
        >
          <MermaidPreview content={diagramContent!} />
        </div>
      )}
    </div>
  );
}
