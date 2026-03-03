/**
 * badge-renderer.ts — Story 7.3 + Heatmap
 *
 * Injects colored review overlays onto Mermaid SVG nodes:
 *   1. Heatmap — semi-transparent color overlay on node shapes
 *   2. Badge  — small severity dot at top-right corner, clickable for detail
 *
 * Operates directly on SVG DOM elements; no React dependency.
 *
 * Strategy:
 * - Badges are placed INSIDE each node <g> using local getBBox coordinates.
 *   This avoids coordinate-space mismatches (viewBox, CTM transforms).
 * - Heatmap overlays clone the shape and use inline styles to override
 *   Mermaid's CSS rules that would otherwise mask the fill.
 */

import { mapSvgNodeId } from './svg-id-mapper';
import type { Annotation, Severity } from '@/lib/ai/graphs/live-review.graph';

// ── Appearance ────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<Severity, string> = {
  ok: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

/** Opacity for the heatmap overlay on node shapes. */
const HEATMAP_OPACITY = 0.18;

const BADGE_CLASS = 'review-badge';
const HEATMAP_CLASS = 'review-heatmap';
const BADGE_RADIUS = 7;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Find the primary visible shape element inside a Mermaid node `<g>`.
 * Mermaid v11 uses rect, polygon, circle, or path as direct children.
 * We use `:scope > *` to only match direct children and skip nested label rects.
 */
function findNodeShape(nodeEl: SVGGElement): SVGElement | null {
  // Try direct children first (most reliable)
  for (const tag of ['rect', 'polygon', 'circle', 'path']) {
    const el = nodeEl.querySelector<SVGElement>(`:scope > ${tag}`);
    if (el) return el;
  }
  // Fallback: any descendant shape (for deeply nested Mermaid structures)
  for (const tag of ['rect', 'polygon', 'circle', 'path']) {
    const el = nodeEl.querySelector<SVGElement>(tag);
    if (el) return el;
  }
  return null;
}

/**
 * Get the bounding box of a shape in the node's local coordinate space.
 * Falls back to the node group's bbox if the shape bbox fails.
 */
function getShapeBBox(
  nodeEl: SVGGElement
): { x: number; y: number; width: number; height: number } | null {
  try {
    return (nodeEl as SVGGraphicsElement).getBBox();
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Remove all existing review-badge and heatmap elements from the SVG.
 */
export function clearBadges(svgRoot: SVGSVGElement): void {
  svgRoot.querySelectorAll<SVGElement>(`.${BADGE_CLASS}`).forEach((el) => el.remove());
  svgRoot.querySelectorAll<SVGElement>(`.${HEATMAP_CLASS}`).forEach((el) => el.remove());
}

/**
 * Inject heatmap overlays + severity badges onto diagram nodes.
 * Clears any previously rendered overlays first.
 *
 * Heatmap: a cloned shape element with inline-styled severity color,
 *          inserted right after the original shape inside the node `<g>`.
 *
 * Badge:   a small `<g class="review-badge">` placed inside the node `<g>`
 *          at the top-right corner (local coordinates from getBBox).
 *          Fires `review-badge-click` CustomEvent on click.
 */
export function injectBadges(svgRoot: SVGSVGElement, annotations: Annotation[]): void {
  clearBadges(svgRoot);

  if (!annotations.length) return;

  const ns = 'http://www.w3.org/2000/svg';

  // Build lookup: nodeId → annotation
  const annotationMap = new Map<string, Annotation>();
  for (const a of annotations) {
    annotationMap.set(a.nodeId, a);
  }

  // Find all node <g> elements in the SVG
  const nodeEls = svgRoot.querySelectorAll<SVGGElement>('g.node');

  nodeEls.forEach((nodeEl) => {
    const nodeId = mapSvgNodeId(nodeEl.id) ?? nodeEl.id;
    const annotation = annotationMap.get(nodeId);
    if (!annotation) return;

    const color = SEVERITY_COLOR[annotation.severity] ?? SEVERITY_COLOR.medium;

    // ── Heatmap overlay ────────────────────────────────────────────────────
    const shape = findNodeShape(nodeEl);
    if (shape) {
      const overlay = shape.cloneNode(false) as SVGElement;
      overlay.setAttribute('class', HEATMAP_CLASS);
      // Use inline styles with !important to override Mermaid's CSS
      overlay.style.setProperty('fill', color, 'important');
      overlay.style.setProperty('opacity', String(HEATMAP_OPACITY), 'important');
      overlay.style.setProperty('stroke', color, 'important');
      overlay.style.setProperty('stroke-width', '2', 'important');
      overlay.style.setProperty('stroke-opacity', '0.6', 'important');
      overlay.style.setProperty('pointer-events', 'none', 'important');
      // Remove any class that Mermaid might use to style the original shape
      overlay.removeAttribute('id');
      shape.after(overlay);
    }

    // ── Badge at top-right ─────────────────────────────────────────────────
    // getBBox in the node's local coordinate space — badge goes inside the
    // same <g> so no coordinate conversion needed.
    const bbox = getShapeBBox(nodeEl);
    if (!bbox) return;

    // Position badge at the top-right of the node bbox
    const cx = bbox.x + bbox.width - 2;
    const cy = bbox.y + 2;

    const badgeGroup = document.createElementNS(ns, 'g') as SVGGElement;
    badgeGroup.setAttribute('class', BADGE_CLASS);
    badgeGroup.setAttribute('data-node-id', nodeId);
    badgeGroup.style.cursor = 'pointer';

    // Circle background
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(BADGE_RADIUS));
    circle.style.setProperty('fill', color, 'important');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '1.5');

    // "!" indicator
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', String(cx));
    text.setAttribute('y', String(cy + 1));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '9');
    text.setAttribute('font-weight', 'bold');
    text.style.setProperty('fill', '#ffffff', 'important');
    text.setAttribute('pointer-events', 'none');
    text.textContent = '!';

    // Native SVG tooltip
    const title = document.createElementNS(ns, 'title');
    title.textContent = annotation.message;

    badgeGroup.appendChild(title);
    badgeGroup.appendChild(circle);
    badgeGroup.appendChild(text);

    // Click dispatches custom event on svgRoot
    badgeGroup.addEventListener('click', (e) => {
      e.stopPropagation();
      svgRoot.dispatchEvent(
        new CustomEvent('review-badge-click', {
          bubbles: true,
          detail: { nodeId, annotation },
        })
      );
    });

    // Append badge INSIDE the node <g> — inherits all transforms automatically
    nodeEl.appendChild(badgeGroup);
  });
}
