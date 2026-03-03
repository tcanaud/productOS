'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { mapSvgNodeId, mapSvgEdgeId } from '@/lib/svg/svg-id-mapper';

/** Position in viewport coordinates (clientX/clientY). */
export type ClickPosition = { x: number; y: number };

/** CSS injected into the SVG to power hover highlights. Avoids Tailwind purge issues. */
const HOVER_STYLE = `
  .node.diagram-node-hover > rect,
  .node.diagram-node-hover > circle,
  .node.diagram-node-hover > polygon,
  .node.diagram-node-hover > path {
    filter: drop-shadow(0 0 6px #6366f1);
  }
  .node { cursor: pointer; }
  .edgePath { cursor: pointer; }
  .edgePath.diagram-edge-hover path {
    stroke: #6366f1;
    stroke-width: 2.5;
  }
`;

type Props = {
  content: string;
  /** Called when the user clicks a diagram node. */
  onNodeClick?: (nodeId: string, pos: ClickPosition) => void;
  /** Called when the user clicks a diagram edge. */
  onEdgeClick?: (edgeId: string, pos: ClickPosition, from: string, to: string) => void;
};

let mermaidInitialized = false;

export function MermaidPreview({ content, onNodeClick, onEdgeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
          mermaidInitialized = true;
        }

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, content.trim() || 'flowchart TD\n  A[Start]');
        if (!containerRef.current) return;

        containerRef.current.innerHTML = svg;
        setError(null);

        // ── Inject hover CSS into the rendered SVG ────────────────────────
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
          const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
          styleEl.textContent = HOVER_STYLE;
          svgEl.insertBefore(styleEl, svgEl.firstChild);
        }

        // ── Attach node handlers ──────────────────────────────────────────
        const nodeEls = containerRef.current.querySelectorAll<SVGGElement>('g.node');
        nodeEls.forEach((nodeEl) => {
          nodeEl.addEventListener('mouseenter', () => {
            nodeEl.classList.add('diagram-node-hover');
          });
          nodeEl.addEventListener('mouseleave', () => {
            nodeEl.classList.remove('diagram-node-hover');
          });
          if (onNodeClick) {
            nodeEl.addEventListener('click', (e) => {
              e.stopPropagation();
              const nodeId = mapSvgNodeId(nodeEl.id) ?? nodeEl.id;
              onNodeClick(nodeId, { x: e.clientX, y: e.clientY });
            });
          }
        });

        // ── Attach edge handlers ──────────────────────────────────────────
        const edgeEls = containerRef.current.querySelectorAll<SVGGElement>('g.edgePath');
        edgeEls.forEach((edgeEl) => {
          edgeEl.addEventListener('mouseenter', () => {
            edgeEl.classList.add('diagram-edge-hover');
          });
          edgeEl.addEventListener('mouseleave', () => {
            edgeEl.classList.remove('diagram-edge-hover');
          });
          if (onEdgeClick) {
            edgeEl.addEventListener('click', (e) => {
              e.stopPropagation();
              const edge = mapSvgEdgeId(edgeEl.id);
              onEdgeClick(
                edgeEl.id,
                { x: e.clientX, y: e.clientY },
                edge?.from ?? '',
                edge?.to ?? ''
              );
            });
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid Mermaid syntax');
      }
    };

    void renderMermaid();
  }, [content, onNodeClick, onEdgeClick]);

  return (
    <div className="relative h-full w-full overflow-auto bg-white p-4">
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="font-mono">{error}</span>
        </div>
      )}
      <div ref={containerRef} className="flex min-h-[200px] items-center justify-center" />
    </div>
  );
}
