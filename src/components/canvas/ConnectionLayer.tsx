'use client';

import type { CanvasArtifact, CanvasConnection } from '@/lib/canvas/types';

interface ConnectionLayerProps {
  connections: CanvasConnection[];
  artifacts: CanvasArtifact[];
  zoom: number;
}

interface Point {
  x: number;
  y: number;
}

function cardRightCenter(a: CanvasArtifact): Point {
  return { x: a.position.x + a.position.width, y: a.position.y + a.position.height / 2 };
}

function cardLeftCenter(a: CanvasArtifact): Point {
  return { x: a.position.x, y: a.position.y + a.position.height / 2 };
}

function bezierPath(src: Point, tgt: Point): string {
  const dx = Math.abs(tgt.x - src.x) * 0.5;
  return `M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${tgt.x - dx} ${tgt.y}, ${tgt.x} ${tgt.y}`;
}

function midpoint(src: Point, tgt: Point): Point {
  return { x: (src.x + tgt.x) / 2, y: (src.y + tgt.y) / 2 };
}

/**
 * ConnectionLayer — Story 8.3
 *
 * SVG overlay that renders cubic Bézier connection lines between canvas artifact cards.
 * Positioned absolutely over the world div with overflow:visible so lines reach
 * between distant cards. pointer-events:none ensures drag interactions are not blocked.
 */
export function ConnectionLayer({ connections, artifacts }: ConnectionLayerProps) {
  if (connections.length === 0) return null;

  const artifactMap = new Map<string, CanvasArtifact>(artifacts.map((a) => [a.id, a]));

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" opacity="0.6" />
        </marker>
      </defs>

      {connections.map((conn) => {
        const source = artifactMap.get(conn.sourceId);
        const target = artifactMap.get(conn.targetId);
        if (!source || !target) return null;

        const src = cardRightCenter(source);
        const tgt = cardLeftCenter(target);
        const mid = midpoint(src, tgt);
        const d = bezierPath(src, tgt);
        const pathId = `conn-path-${conn.id}`;

        return (
          <g key={conn.id}>
            <path
              id={pathId}
              d={d}
              stroke="hsl(var(--primary))"
              strokeOpacity="0.6"
              strokeWidth="1.5"
              strokeDasharray="6 3"
              fill="none"
              markerEnd="url(#arrowhead)"
            />
            {conn.label && (
              <text
                x={mid.x}
                y={mid.y - 6}
                textAnchor="middle"
                fontSize="11"
                fill="hsl(var(--muted-foreground))"
              >
                {conn.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
