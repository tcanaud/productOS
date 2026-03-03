/**
 * badge-renderer.ts — Story 7.3
 *
 * Injects colored review-badge overlays onto Mermaid SVG nodes.
 * Operates directly on SVG DOM elements; no React dependency.
 */

import { mapSvgNodeId } from './svg-id-mapper';
import type { Annotation, Severity } from '@/lib/ai/graphs/live-review.graph';

// ── Badge appearance ────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<Severity, string> = {
  ok: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const BADGE_CLASS = 'review-badge';
const BADGE_RADIUS = 8;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Remove all existing review-badge `<g>` elements from the SVG.
 */
export function clearBadges(svgRoot: SVGSVGElement): void {
  const existing = svgRoot.querySelectorAll<SVGGElement>(`g.${BADGE_CLASS}`);
  existing.forEach((el) => el.remove());
}

/**
 * Inject colored badges onto diagram nodes according to annotations.
 * Clears any previously rendered badges first.
 *
 * Each badge is a `<g class="review-badge">` containing:
 *  - a filled `<circle>` in the severity color
 *  - a `<text>` dot indicator
 *  - a `<title>` for the native SVG tooltip
 *
 * The badge fires a `review-badge-click` CustomEvent on the svgRoot when clicked.
 */
export function injectBadges(svgRoot: SVGSVGElement, annotations: Annotation[]): void {
  clearBadges(svgRoot);

  if (!annotations.length) return;

  // Build a lookup: nodeId → annotation
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

    // Determine badge position: top-right corner of node bounding box
    let bbox: DOMRect | null = null;
    try {
      bbox = (nodeEl as SVGGraphicsElement).getBBox();
    } catch {
      return; // getBBox can throw in non-connected DOMs (tests/SSR)
    }

    const cx = bbox.x + bbox.width;
    const cy = bbox.y;

    // Create badge group
    const ns = 'http://www.w3.org/2000/svg';
    const badgeGroup = document.createElementNS(ns, 'g') as SVGGElement;
    badgeGroup.setAttribute('class', BADGE_CLASS);
    badgeGroup.setAttribute('data-node-id', nodeId);
    badgeGroup.style.cursor = 'pointer';

    // Circle background
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(BADGE_RADIUS));
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '1.5');

    // Dot indicator text
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', String(cx));
    text.setAttribute('y', String(cy + 1));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '8');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', '#ffffff');
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

    // Append badge to the SVG (not inside the node group to avoid clipping)
    const svgParent = nodeEl.closest('svg') ?? svgRoot;
    svgParent.appendChild(badgeGroup);
  });
}
