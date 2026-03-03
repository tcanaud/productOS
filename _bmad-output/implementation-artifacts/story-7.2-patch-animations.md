# Story 7.2 — Patch Animations

## Status: review

## Story

**As a** Product Manager,
**I want** to see diagram changes animated smoothly when the AI modifies the flow,
**so that** I can visually track what changed instead of comparing static snapshots.

## Acceptance Criteria

1. **Given** a JSON patch adds a new node
   **When** the diagram re-renders
   **Then** the new node fades in with a smooth animation (300ms)

2. **Given** a JSON patch removes a node
   **When** the diagram re-renders
   **Then** the removed node fades out before disappearing (200ms)

3. **Given** a JSON patch adds a new edge
   **When** the diagram re-renders
   **Then** the edge draws in progressively (line animation, stroke-dashoffset)

4. **Given** a full diagram is generated for the first time
   **When** it renders
   **Then** nodes appear sequentially (top-to-bottom/left-to-right order) with staggered timing (50ms per node)

## Technical Notes

- Mermaid renders to SVG synchronously via `mermaid.render()` — all animation must be applied as post-processing on the SVG DOM after render
- **Node fade-in**: inject a CSS keyframe `@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }` into the SVG `<defs>` and apply `animation: fadeIn 300ms ease-out` on new node `<g>` elements
- **Node fade-out**: before triggering re-render, identify removed node SVG elements, apply `animation: fadeOut 200ms ease-in forwards` then wait for `animationend` event before proceeding with the actual re-render
- **Edge draw-in**: use `stroke-dasharray` + `stroke-dashoffset` trick on `<path>` elements inside `.edgePath` groups; inject CSS for `@keyframes drawEdge { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }` with `stroke-dasharray: 1` (normalized via `getTotalLength()`)
- **Staggered initial render**: on first render (no previous diagram state), iterate node `<g>` elements in DOM order and apply increasing `animation-delay` (index × 50ms)
- **Diff computation**: compare previous `JsonGraph` snapshot to the new one before re-rendering to identify added/removed nodes and edges; store previous graph in a React ref
- No new Prisma model or API route needed — purely frontend animation layer

## Dev Notes

### Existing Components to Modify

- `src/components/diagram/MermaidPreview.tsx`
  - Add a `prevGraphRef` (React ref) to hold the last rendered `JsonGraph` snapshot
  - Before calling `mermaid.render()`, compute the diff: `{ addedNodes, removedNodes, addedEdges }` by comparing `prevGraphRef.current` to the new graph
  - For removed nodes/edges: query current SVG `<g>` elements by mapped ID, apply fade-out animation, await completion (200ms), then proceed with re-render
  - After `mermaid.render()` resolves and SVG is injected into the DOM:
    1. Call `animateAddedNodes(svgRoot, addedNodeIds)` — applies fade-in CSS
    2. Call `animateAddedEdges(svgRoot, addedEdgeIds)` — applies draw-in CSS
    3. If `prevGraphRef.current` was null (first render), call `animateInitialRender(svgRoot)`
  - Update `prevGraphRef.current = newGraph` after animation setup
  - Accept new optional prop: `graph?: JsonGraph` (the structured graph driving the diagram, passed alongside `mermaid` string)

### New Files

- `src/lib/svg/patch-animator.ts` — pure utility module, no React dependency:
  - `diffGraphs(prev: JsonGraph | null, next: JsonGraph): GraphDiff` — returns `{ addedNodes: string[], removedNodes: string[], addedEdges: EdgeId[], removedEdges: EdgeId[] }`
  - `animateAddedNodes(svgRoot: SVGElement, nodeIds: string[]): void` — maps node IDs to SVG `<g>` elements via `mapSvgNodeId`, injects fade-in keyframe if absent, applies animation style
  - `animateRemovedNodes(svgRoot: SVGElement, nodeIds: string[]): Promise<void>` — applies fade-out animation and returns a promise that resolves after 200ms
  - `animateAddedEdges(svgRoot: SVGElement, edgeIds: EdgeId[]): void` — maps edge IDs to `.edgePath` SVG elements, reads `getTotalLength()` on inner `<path>`, sets up draw-in animation
  - `animateInitialRender(svgRoot: SVGElement): void` — queries all `.node` `<g>` elements in DOM order, applies staggered fade-in with `animation-delay: index * 50ms`
  - `injectKeyframes(svgRoot: SVGElement): void` — idempotent helper that injects required `<style>` with all keyframes into SVG `<defs>` once

### Types

```typescript
// src/lib/svg/patch-animator.ts

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
```

### CSS Keyframes (injected into SVG `<defs>`)

```css
@keyframes pgFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pgFadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes pgDrawEdge {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}
```

### Animation Parameters

| Event         | Duration | Easing      | Property                   |
| ------------- | -------- | ----------- | -------------------------- |
| Node add      | 300ms    | ease-out    | opacity + scale (0.95→1)   |
| Node remove   | 200ms    | ease-in     | opacity (1→0), forwards    |
| Edge draw-in  | 400ms    | ease-in-out | stroke-dashoffset (1→0)    |
| Initial nodes | 300ms    | ease-out    | opacity, stagger 50ms/node |

### Integration with Story 7.1

- `MermaidPreview.tsx` already post-processes SVG (hover handlers, `svg-id-mapper.ts`) — animation post-processing runs in the same `useEffect` block, after hover handler attachment
- `animateRemovedNodes` must run **before** the re-render triggers, so the fade-out is visible on the old SVG; the `prevGraphRef` diff is computed at the start of the render effect

### No New API Routes

All animation logic is entirely client-side. The `graph` prop carries the structured `JsonGraph` data already available in the parent `DiagramEditorLayout` / `DiagramPreviewPanel`.

## Tasks / Subtasks

- [x] Task 1: Create `src/lib/svg/patch-animator.ts` pure utility module
  - [x] 1.1 Define `EdgeId` and `GraphDiff` types
  - [x] 1.2 Implement `injectKeyframes(svgRoot)` — idempotent keyframe injection into SVG `<defs>`
  - [x] 1.3 Implement `diffGraphs(prev, next)` — structural diff between two JsonGraph snapshots
  - [x] 1.4 Implement `animateAddedNodes(svgRoot, nodeIds)` — 300ms fade-in for new nodes
  - [x] 1.5 Implement `animateRemovedNodes(svgRoot, nodeIds)` — 200ms fade-out, returns Promise
  - [x] 1.6 Implement `animateAddedEdges(svgRoot, edgeIds)` — 400ms stroke-dashoffset draw-in
  - [x] 1.7 Implement `animateInitialRender(svgRoot)` — staggered 50ms/node fade-in on first render

- [x] Task 2: Update `MermaidPreview.tsx` to integrate animations
  - [x] 2.1 Add optional `graph?: JsonGraph` prop
  - [x] 2.2 Add `prevGraphRef` to track previous JsonGraph snapshot
  - [x] 2.3 Compute diff before re-render; await `animateRemovedNodes` before `mermaid.render()`
  - [x] 2.4 After render: call `animateInitialRender` on first render, else `animateAddedNodes` + `animateAddedEdges`
  - [x] 2.5 Update `prevGraphRef.current` after animations are set up

- [x] Task 3: Thread `graph` prop through the component hierarchy
  - [x] 3.1 Add `graph?: JsonGraph` to `DiagramPreviewPanel` props and forward to `MermaidPreview`
  - [x] 3.2 Pass `currentGraphRef.current` as `graph` from `StudioLayout` to `DiagramPreviewPanel`

- [x] Task 4: Write unit tests for `patch-animator.ts`
  - [x] 4.1 Tests for `diffGraphs` — added/removed nodes and edges, null prev (first render), identical graphs
  - [x] 4.2 Tests for `injectKeyframes` — inserts style, is idempotent
  - [x] 4.3 Tests for `animateAddedNodes` — applies animation, skips non-listed nodes
  - [x] 4.4 Tests for `animateRemovedNodes` — applies animation, resolves after 200ms
  - [x] 4.5 Tests for `animateAddedEdges` — sets stroke-dashoffset draw-in, skips non-listed edges
  - [x] 4.6 Tests for `animateInitialRender` — staggered delays, opacity set, no-op when no nodes

## File List

- `src/lib/svg/patch-animator.ts` — new: pure animation utility module
- `src/components/diagram/MermaidPreview.tsx` — modified: added `graph` prop and animation post-processing
- `src/components/studio/DiagramPreviewPanel.tsx` — modified: added `graph` prop, forwarded to `MermaidPreview`
- `src/components/studio/StudioLayout.tsx` — modified: passes `currentGraphRef.current` as `graph` to `DiagramPreviewPanel`
- `src/__tests__/svg/patch-animator.test.ts` — new: 19 unit tests for patch-animator

## Dev Agent Record

### Implementation Notes

- **AC1 (node add 300ms fade-in)**: `animateAddedNodes` applies `pgFadeIn 300ms ease-out both` directly on node `<g>` elements after `mermaid.render()` resolves. Nodes are located by `id^="flowchart-{nodeId}-"` selector.
- **AC2 (node remove 200ms fade-out)**: `animateRemovedNodes` applies `pgFadeOut 200ms ease-in forwards` on old SVG before re-render, then resolves a Promise after 200ms. The `await` in the `renderMermaid` function ensures the fade-out completes before the new SVG is injected.
- **AC3 (edge draw-in)**: `animateAddedEdges` uses `getTotalLength()` on the inner `<path>` to normalise `stroke-dasharray`/`stroke-dashoffset`, then animates `pgDrawEdge 400ms ease-in-out forwards`. The animation CSS is injected idempotently via `injectKeyframes` into SVG `<defs>`.
- **AC4 (initial stagger)**: On first render (`prevGraphRef.current === null`), `animateInitialRender` iterates all `g.node` elements in DOM order and applies `pgFadeIn 300ms ease-out {i*50}ms both`. `prevGraphRef` is updated to the graph value after animation setup.
- **Graph prop threading**: `StudioLayout` already maintained `currentGraphRef` tracking the `JsonGraph` (set on `diagram-full` SSE events and updated on `diagram-update` via `applyPatch`). The prop is passed as-is (`currentGraphRef.current ?? undefined`). React won't re-render on ref mutations, so graph changes are tied to `content` string changes, which correctly triggers the `useEffect`.
- **Hover handlers (Story 7.1) preserved**: Animation post-processing runs after hover CSS injection and before hover event handler attachment, maintaining full backward compatibility.
- **No new dependencies**: All animation uses native SVG/CSS — no external libraries.

### Debug Log

No blocking issues encountered.

## Change Log

- 2026-03-03: Story 7.2 implemented — patch animations for nodes/edges via SVG post-processing. New `patch-animator.ts` utility, updated `MermaidPreview`, `DiagramPreviewPanel`, `StudioLayout`. 19 new unit tests, 612 total passing.
