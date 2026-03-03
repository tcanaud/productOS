/**
 * Tests for Story 7.2: patch-animator
 *
 * Verifies:
 * - diffGraphs computes correct added/removed node and edge sets
 * - injectKeyframes inserts <style> idempotently
 * - animateAddedNodes applies pgFadeIn animation to matched SVG nodes
 * - animateRemovedNodes applies pgFadeOut and resolves after 200ms
 * - animateAddedEdges sets up stroke-dashoffset draw-in on matched edge paths
 * - animateInitialRender applies staggered fade-in to all nodes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  diffGraphs,
  injectKeyframes,
  animateAddedNodes,
  animateRemovedNodes,
  animateAddedEdges,
  animateInitialRender,
} from '@/lib/svg/patch-animator';
import type { JsonGraph } from '@/lib/json2mermaid/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGraph(nodeIds: string[], edges: { from: string; to: string }[] = []): JsonGraph {
  return {
    diagramType: 'flowchart',
    nodes: nodeIds.map((id) => ({ id, label: id })),
    edges: edges.map((e) => ({ from: e.from, to: e.to })),
  };
}

/** Creates a minimal SVG element with a querySelector/querySelectorAll stub. */
function makeSvg(nodeIds: string[] = [], edgeIds: string[] = []): SVGElement {
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  // Add node <g> elements
  for (const nodeId of nodeIds) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', `flowchart-${nodeId}-0`);
    g.setAttribute('class', 'node default');
    svgEl.appendChild(g);
  }

  // Add edge <g> elements with inner <path>
  for (const edgeId of edgeIds) {
    const [from, to] = edgeId.split('→');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', `L-${from}-${to}-0`);
    g.setAttribute('class', 'edgePath');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // getTotalLength is not available in jsdom — stub it
    (path as SVGPathElement & { getTotalLength: () => number }).getTotalLength = () => 150;
    g.appendChild(path);
    svgEl.appendChild(g);
  }

  return svgEl as unknown as SVGElement;
}

// ── diffGraphs ────────────────────────────────────────────────────────────────

describe('diffGraphs', () => {
  it('returns empty diff when prev is null (first render)', () => {
    const next = makeGraph(['A', 'B'], [{ from: 'A', to: 'B' }]);
    const diff = diffGraphs(null, next);
    expect(diff.addedNodes).toEqual([]);
    expect(diff.removedNodes).toEqual([]);
    expect(diff.addedEdges).toEqual([]);
    expect(diff.removedEdges).toEqual([]);
  });

  it('detects added nodes', () => {
    const prev = makeGraph(['A']);
    const next = makeGraph(['A', 'B', 'C']);
    const diff = diffGraphs(prev, next);
    expect(diff.addedNodes).toContain('B');
    expect(diff.addedNodes).toContain('C');
    expect(diff.removedNodes).toHaveLength(0);
  });

  it('detects removed nodes', () => {
    const prev = makeGraph(['A', 'B', 'C']);
    const next = makeGraph(['A']);
    const diff = diffGraphs(prev, next);
    expect(diff.removedNodes).toContain('B');
    expect(diff.removedNodes).toContain('C');
    expect(diff.addedNodes).toHaveLength(0);
  });

  it('detects added edges', () => {
    const prev = makeGraph(['A', 'B']);
    const next = makeGraph(['A', 'B'], [{ from: 'A', to: 'B' }]);
    const diff = diffGraphs(prev, next);
    expect(diff.addedEdges).toHaveLength(1);
    expect(diff.addedEdges[0]).toEqual({ from: 'A', to: 'B' });
  });

  it('detects removed edges', () => {
    const prev = makeGraph(['A', 'B'], [{ from: 'A', to: 'B' }]);
    const next = makeGraph(['A', 'B']);
    const diff = diffGraphs(prev, next);
    expect(diff.removedEdges).toHaveLength(1);
    expect(diff.removedEdges[0]).toEqual({ from: 'A', to: 'B' });
  });

  it('handles identical graphs with no diff', () => {
    const graph = makeGraph(['A', 'B'], [{ from: 'A', to: 'B' }]);
    const diff = diffGraphs(graph, graph);
    expect(diff.addedNodes).toHaveLength(0);
    expect(diff.removedNodes).toHaveLength(0);
    expect(diff.addedEdges).toHaveLength(0);
    expect(diff.removedEdges).toHaveLength(0);
  });
});

// ── injectKeyframes ───────────────────────────────────────────────────────────

describe('injectKeyframes', () => {
  it('injects a <style> element into SVG defs', () => {
    const svgEl = makeSvg();
    injectKeyframes(svgEl);
    const style = svgEl.querySelector('[data-pg-keyframes]');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('pgFadeIn');
    expect(style?.textContent).toContain('pgFadeOut');
    expect(style?.textContent).toContain('pgDrawEdge');
  });

  it('is idempotent — only inserts once', () => {
    const svgEl = makeSvg();
    injectKeyframes(svgEl);
    injectKeyframes(svgEl);
    injectKeyframes(svgEl);
    const styles = svgEl.querySelectorAll('[data-pg-keyframes]');
    expect(styles).toHaveLength(1);
  });
});

// ── animateAddedNodes ─────────────────────────────────────────────────────────

describe('animateAddedNodes', () => {
  it('applies pgFadeIn animation to matched nodes', () => {
    const svgEl = makeSvg(['A', 'B', 'C']);
    animateAddedNodes(svgEl, ['A', 'C']);

    const nodeA = svgEl.querySelector<SVGGElement>('#flowchart-A-0');
    const nodeB = svgEl.querySelector<SVGGElement>('#flowchart-B-0');
    const nodeC = svgEl.querySelector<SVGGElement>('#flowchart-C-0');

    expect(nodeA?.style.animation).toContain('pgFadeIn');
    expect(nodeC?.style.animation).toContain('pgFadeIn');
    // Node B was not in the addedNodes list — should be untouched
    expect(nodeB?.style.animation ?? '').not.toContain('pgFadeIn');
  });

  it('does nothing when nodeIds is empty', () => {
    const svgEl = makeSvg(['A']);
    animateAddedNodes(svgEl, []);
    const nodeA = svgEl.querySelector<SVGGElement>('#flowchart-A-0');
    expect(nodeA?.style.animation ?? '').toBe('');
  });

  it('injects keyframes when applying node animation', () => {
    const svgEl = makeSvg(['A']);
    animateAddedNodes(svgEl, ['A']);
    expect(svgEl.querySelector('[data-pg-keyframes]')).not.toBeNull();
  });
});

// ── animateRemovedNodes ───────────────────────────────────────────────────────

describe('animateRemovedNodes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('applies pgFadeOut animation to matched nodes', async () => {
    const svgEl = makeSvg(['X', 'Y']);
    const promise = animateRemovedNodes(svgEl, ['X']);

    const nodeX = svgEl.querySelector<SVGGElement>('#flowchart-X-0');
    expect(nodeX?.style.animation).toContain('pgFadeOut');

    vi.advanceTimersByTime(200);
    await promise;
  });

  it('resolves immediately when nodeIds is empty', async () => {
    const svgEl = makeSvg(['A']);
    const promise = animateRemovedNodes(svgEl, []);
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves after 200ms', async () => {
    const svgEl = makeSvg(['A']);
    let resolved = false;
    const promise = animateRemovedNodes(svgEl, ['A']).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    vi.advanceTimersByTime(199);
    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });
});

// ── animateAddedEdges ─────────────────────────────────────────────────────────

describe('animateAddedEdges', () => {
  it('applies pgDrawEdge animation to matched edge paths', () => {
    const svgEl = makeSvg([], ['A→B', 'C→D']);
    animateAddedEdges(svgEl, [{ from: 'A', to: 'B' }]);

    const edgeGroupAB = svgEl.querySelector<SVGGElement>('#L-A-B-0');
    const pathAB = edgeGroupAB?.querySelector<SVGPathElement>('path');
    expect(pathAB?.style.animation).toContain('pgDrawEdge');
    expect(pathAB?.style.strokeDasharray).toBeTruthy();
    expect(pathAB?.style.strokeDashoffset).toBeTruthy();

    // C→D was not animated
    const edgeGroupCD = svgEl.querySelector<SVGGElement>('#L-C-D-0');
    const pathCD = edgeGroupCD?.querySelector<SVGPathElement>('path');
    expect(pathCD?.style.animation ?? '').not.toContain('pgDrawEdge');
  });

  it('does nothing when edgeIds is empty', () => {
    const svgEl = makeSvg([], ['A→B']);
    animateAddedEdges(svgEl, []);
    const pathAB = svgEl.querySelector<SVGPathElement>('#L-A-B-0 path');
    expect(pathAB?.style.animation ?? '').toBe('');
  });
});

// ── animateInitialRender ──────────────────────────────────────────────────────

describe('animateInitialRender', () => {
  it('applies staggered pgFadeIn to all nodes', () => {
    const svgEl = makeSvg(['A', 'B', 'C']);
    animateInitialRender(svgEl);

    const nodes = svgEl.querySelectorAll<SVGGElement>('g.node');
    nodes.forEach((el, i) => {
      expect(el.style.animation).toContain('pgFadeIn');
      expect(el.style.animation).toContain(`${i * 50}ms`);
    });
  });

  it('sets opacity to 0 on all nodes initially', () => {
    const svgEl = makeSvg(['A', 'B']);
    animateInitialRender(svgEl);
    const nodes = svgEl.querySelectorAll<SVGGElement>('g.node');
    nodes.forEach((el) => {
      expect(el.style.opacity).toBe('0');
    });
  });

  it('does nothing when there are no nodes', () => {
    const svgEl = makeSvg([]);
    // Should not throw
    expect(() => animateInitialRender(svgEl)).not.toThrow();
  });
});
