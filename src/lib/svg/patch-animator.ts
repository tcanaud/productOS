/**
 * patch-animator.ts — Story 7.2
 *
 * Pure SVG post-processing utilities for animating diagram changes.
 * No React dependency; operates directly on SVG DOM elements.
 */

import type { JsonGraph, GraphEdge } from '@/lib/json2mermaid/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EdgeId {
  from: string;
  to: string;
}

export interface GraphDiff {
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: EdgeId[];
  removedEdges: EdgeId[];
}

// ── Keyframes marker ──────────────────────────────────────────────────────────

const KEYFRAMES_MARKER = 'data-pg-keyframes';

const KEYFRAMES_CSS = `
@keyframes pgFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes pgFadeOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes pgDrawEdge {
  from { stroke-dashoffset: 1; }
  to   { stroke-dashoffset: 0; }
}
`;

// ── Core utilities ────────────────────────────────────────────────────────────

/**
 * Idempotent: injects animation keyframes as a `<style>` into the SVG `<defs>`.
 * Safe to call multiple times — only inserts once per SVG element.
 */
export function injectKeyframes(svgRoot: SVGElement): void {
  if (svgRoot.querySelector(`[${KEYFRAMES_MARKER}]`)) return;

  let defs = svgRoot.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgRoot.insertBefore(defs, svgRoot.firstChild);
  }

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.setAttribute(KEYFRAMES_MARKER, 'true');
  style.textContent = KEYFRAMES_CSS;
  defs.appendChild(style);
}

// ── Diff computation ──────────────────────────────────────────────────────────

/**
 * Computes the structural diff between two JsonGraph snapshots.
 * Returns sets of added/removed node IDs and edge from/to pairs.
 */
export function diffGraphs(prev: JsonGraph | null, next: JsonGraph): GraphDiff {
  if (!prev) {
    // First render — everything is "added" for stagger purposes; addedNodes/Edges are empty
    return { addedNodes: [], removedNodes: [], addedEdges: [], removedEdges: [] };
  }

  const prevNodeIds = new Set(prev.nodes.map((n) => n.id));
  const nextNodeIds = new Set(next.nodes.map((n) => n.id));

  const addedNodes = next.nodes.filter((n) => !prevNodeIds.has(n.id)).map((n) => n.id);
  const removedNodes = prev.nodes.filter((n) => !nextNodeIds.has(n.id)).map((n) => n.id);

  const edgeKey = (e: GraphEdge) => `${e.from}→${e.to}`;
  const prevEdgeKeys = new Set(prev.edges.map(edgeKey));
  const nextEdgeKeys = new Set(next.edges.map(edgeKey));

  const addedEdges = next.edges
    .filter((e) => !prevEdgeKeys.has(edgeKey(e)))
    .map((e) => ({ from: e.from, to: e.to }));

  const removedEdges = prev.edges
    .filter((e) => !nextEdgeKeys.has(edgeKey(e)))
    .map((e) => ({ from: e.from, to: e.to }));

  return { addedNodes, removedNodes, addedEdges, removedEdges };
}

// ── Node helpers ──────────────────────────────────────────────────────────────

/**
 * Finds a Mermaid SVG node `<g>` element whose id matches `flowchart-{nodeId}-N`.
 */
function findNodeEl(svgRoot: SVGElement, nodeId: string): SVGGElement | null {
  // Mermaid encodes the id; try a direct attribute selector first
  return (
    svgRoot.querySelector<SVGGElement>(`g.node[id^="flowchart-${nodeId}-"]`) ??
    // Fallback: scan all nodes and match extracted id
    Array.from(svgRoot.querySelectorAll<SVGGElement>('g.node')).find((el) => {
      const m = el.id.match(/^flowchart-(.+)-\d+$/);
      return m?.[1] === nodeId;
    }) ??
    null
  );
}

/**
 * Applies fade-in animation to newly added nodes.
 * Duration: 300ms ease-out.
 */
export function animateAddedNodes(svgRoot: SVGElement, nodeIds: string[]): void {
  if (nodeIds.length === 0) return;
  injectKeyframes(svgRoot);
  for (const nodeId of nodeIds) {
    const el = findNodeEl(svgRoot, nodeId);
    if (!el) continue;
    el.style.animation = 'pgFadeIn 300ms ease-out both';
  }
}

/**
 * Applies fade-out animation to nodes about to be removed.
 * Returns a Promise that resolves after the 200ms animation completes.
 * Call this BEFORE triggering the Mermaid re-render.
 */
export function animateRemovedNodes(svgRoot: SVGElement, nodeIds: string[]): Promise<void> {
  if (nodeIds.length === 0) return Promise.resolve();
  injectKeyframes(svgRoot);

  for (const nodeId of nodeIds) {
    const el = findNodeEl(svgRoot, nodeId);
    if (!el) continue;
    el.style.animation = 'pgFadeOut 200ms ease-in forwards';
  }

  return new Promise((resolve) => setTimeout(resolve, 200));
}

// ── Edge helpers ──────────────────────────────────────────────────────────────

/**
 * Finds a Mermaid SVG edge `<g>` element whose id matches `L-{from}-{to}-N`.
 */
function findEdgeEl(svgRoot: SVGElement, from: string, to: string): SVGGElement | null {
  return (
    svgRoot.querySelector<SVGGElement>(`g.edgePath[id^="L-${from}-${to}-"]`) ??
    Array.from(svgRoot.querySelectorAll<SVGGElement>('g.edgePath')).find((el) => {
      const m = el.id.match(/^L-(.+)-(.+)-\d+$/);
      return m?.[1] === from && m?.[2] === to;
    }) ??
    null
  );
}

/**
 * Applies a draw-in animation (stroke-dashoffset trick) to newly added edges.
 * Duration: 400ms ease-in-out.
 */
export function animateAddedEdges(svgRoot: SVGElement, edgeIds: EdgeId[]): void {
  if (edgeIds.length === 0) return;
  injectKeyframes(svgRoot);

  for (const { from, to } of edgeIds) {
    const groupEl = findEdgeEl(svgRoot, from, to);
    if (!groupEl) continue;

    const pathEl = groupEl.querySelector<SVGPathElement>('path');
    if (!pathEl) continue;

    // Normalise dasharray using total path length
    const len = pathEl.getTotalLength?.() ?? 200;
    pathEl.style.strokeDasharray = `${len}`;
    pathEl.style.strokeDashoffset = `${len}`;
    pathEl.style.animation = `pgDrawEdge 400ms ease-in-out forwards`;
  }
}

// ── Initial render stagger ────────────────────────────────────────────────────

/**
 * Applies a staggered fade-in to all nodes on the first render.
 * Each node delays by `index × 50ms`.
 */
export function animateInitialRender(svgRoot: SVGElement): void {
  injectKeyframes(svgRoot);
  const nodeEls = svgRoot.querySelectorAll<SVGGElement>('g.node');
  nodeEls.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.animation = `pgFadeIn 300ms ease-out ${i * 50}ms both`;
  });
}
