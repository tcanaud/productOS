'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface MermaidThumbnailProps {
  content: string;
}

let mermaidInitialized = false;

/**
 * MermaidThumbnail — lightweight, non-interactive Mermaid preview for Canvas cards.
 * No click handlers, no animations, no badges.
 */
export function MermaidThumbnail({ content }: MermaidThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
          });
          mermaidInitialized = true;
        }

        const id = `mermaid-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const { svg } = await mermaid.render(id, content.trim() || 'flowchart TD\n  A[Start]');
        if (!containerRef.current) return;

        containerRef.current.innerHTML = svg;
        setError(false);

        // Auto-scale SVG to fit container
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
          svgEl.setAttribute('width', '100%');
          svgEl.setAttribute('height', '100%');
          svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }
      } catch {
        setError(true);
      }
    };

    void render();
  }, [content]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center gap-1 text-xs text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        <span>Preview unavailable</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden pointer-events-none"
    />
  );
}
