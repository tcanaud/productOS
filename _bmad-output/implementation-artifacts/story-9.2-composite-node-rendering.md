# Story 9.2 — Composite Node Rendering

## Status: review

## Story

**As a** user,
**I want** composite nodes to be visually distinct in the diagram with a layer indicator badge,
**So that** I can immediately identify which nodes contain child layers.

---

## Acceptance Criteria

1. **Given** a `JsonGraph` contains a node with `type: "composite"` and `childGraphId`
   **When** `json2mermaid` converts the graph to Mermaid syntax
   **Then** the node receives a `:::composite` class appended to its node definition

2. **Given** a `JsonGraph` contains at least one composite node
   **When** `json2mermaid` produces the Mermaid output
   **Then** the output includes a `classDef composite fill:#f0f4ff,stroke:#4f46e5,stroke-width:3px,stroke-dasharray:5 5` declaration

3. **Given** a Mermaid diagram contains composite-classed nodes
   **When** the SVG is rendered and post-processed by `badge-renderer`
   **Then** a layer indicator icon/badge (e.g. stacked-layers SVG icon) is injected into each composite node, similar to existing review badges

4. **Given** a composite node in the diagram
   **When** the user hovers over it
   **Then** composite styling is enhanced (cursor pointer, box-shadow glow effect) indicating interactivity

5. **Given** the existing `GraphNode` interface in `src/lib/json2mermaid/types.ts`
   **When** a composite node is represented
   **Then** the interface includes optional fields `type?: "composite" | string` and `childGraphId?: string`

---

## Technical Notes

- **Requirements**: FR-L1, AR-L4
- **Files to modify**:
  - `src/lib/json2mermaid/types.ts` — add `type` and `childGraphId` to `GraphNode`
  - `src/lib/json2mermaid/index.ts` — emit `:::composite` class on nodes with `type === "composite"`; emit `classDef composite ...` when at least one composite node exists
  - `src/lib/svg/badge-renderer.ts` — add `injectLayerBadge(svg, compositeNodeIds)` to inject a stacked-layers SVG badge on composite nodes
  - `src/components/diagram/MermaidPreview.tsx` — inject CSS for composite hover effect (cursor pointer, indigo glow)

---

## Implementation Guidance

### 1. `GraphNode` type extension (`src/lib/json2mermaid/types.ts`)

Add optional fields to the existing `GraphNode` interface:

```ts
export interface GraphNode {
  id: string;
  label?: string;
  shape?: string;
  type?: 'composite' | string; // NEW
  childGraphId?: string; // NEW
}
```

### 2. `json2mermaid` classDef + class emit (`src/lib/json2mermaid/index.ts`)

After building node definitions:

- For each node where `node.type === "composite"`, append `:::composite` to its Mermaid node line.
- If any composite node was emitted, append to the output:
  ```
  classDef composite fill:#f0f4ff,stroke:#4f46e5,stroke-width:3px,stroke-dasharray:5 5
  ```

### 3. Layer badge injection (`src/lib/svg/badge-renderer.ts`)

Add a new exported function `injectLayerBadges(svgElement: SVGElement, compositeNodeIds: string[]): void`:

- For each composite node ID, resolve the corresponding SVG element using the existing `mapSvgNodeId` from `svg-id-mapper.ts`.
- Inject a small SVG group (`<g class="layer-badge">`) containing a stacked-layers path icon (24×24, indigo `#4f46e5`) positioned at the top-right corner of the node bounding box.
- Badge should not interfere with existing review badges (use a distinct class `layer-badge`).

### 4. Composite hover CSS (`src/components/diagram/MermaidPreview.tsx`)

In the injected `<style>` block (where existing hover/cursor CSS is injected), add:

```css
.node.composite:hover > rect,
.node.composite:hover > polygon,
.node.composite:hover > circle {
  filter: drop-shadow(0 0 6px rgba(79, 70, 229, 0.6));
  cursor: pointer;
}
```

### 5. Wire badge injection into `MermaidPreview`

After SVG post-processing (existing `mapSvgNodeId` loop), collect composite node IDs from the `graph` prop and call `injectLayerBadges(svgEl, compositeIds)`.

---

## Dev Notes

- The `classDef composite` line must only be emitted once per diagram, even if multiple composite nodes exist.
- `injectLayerBadges` should be idempotent: remove existing `.layer-badge` elements before re-injecting on re-render.
- The layer badge SVG path for a stacked-layers icon (heroicons `squares-2x2` or similar):
  ```
  M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z
  M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z
  ```
  Alternatively use a simple `⊞` Unicode character rendered as a foreign object, or an inline SVG path.
- Review badge injection pattern (Story 7.3) is the reference implementation; follow the same approach.

---

## Checklist

- [x] `GraphNode` interface updated with `type` and `childGraphId`
- [x] `json2mermaid` emits `:::composite` for composite nodes
- [x] `json2mermaid` emits `classDef composite` when needed
- [x] `badge-renderer` exports `injectLayerBadges`
- [x] `MermaidPreview` injects composite hover CSS
- [x] `MermaidPreview` calls `injectLayerBadges` after SVG post-processing
- [x] Existing tests for `json2mermaid` pass (non-composite nodes unaffected)
- [x] Manual test: composite node shows badge + glow on hover

---

## Dev Agent Record

### Implementation Plan

Implemented Story 9.2 in 4 files following the reference pattern from Story 7.3 (badge-renderer) and Story 7.1 (SVG post-processing):

1. **`src/lib/json2mermaid/types.ts`** — Added `type?: 'composite' | string` and `childGraphId?: string` as optional fields to `GraphNode`.

2. **`src/lib/json2mermaid/flowchart.ts`** — Modified `renderNode()` to append `:::composite` when `node.type === 'composite'`. Modified `flowchartToMermaid()` to track `hasComposite` flag and emit `classDef composite fill:#f0f4ff,stroke:#4f46e5,stroke-width:3px,stroke-dasharray:5 5` exactly once at the end when needed.

3. **`src/lib/svg/badge-renderer.ts`** — Added `LAYER_BADGE_CLASS`, `LAYER_BADGE_SIZE`, `LAYER_BADGE_COLOR` constants. Added exported `injectLayerBadges(svgRoot, compositeNodeIds)` function that: removes pre-existing `.layer-badge` elements (idempotent), iterates composite node IDs, resolves SVG elements via `mapSvgNodeId`, injects a `<g class="layer-badge">` with indigo circle background + stacked-layers SVG path + tooltip.

4. **`src/components/diagram/MermaidPreview.tsx`** — Added composite hover CSS rules to `HOVER_STYLE` constant. Added `injectLayerBadges` import. Added call to `injectLayerBadges` in the badge useEffect after `injectBadges`, collecting composite node IDs from `graph?.nodes`. Added `graph` to the second useEffect dependency array (and removed now-unnecessary `eslint-disable` comment).

### Tests Added

6 new tests added to `src/__tests__/generate-flow-ai.test.ts` in the `json2mermaid — composite nodes (Story 9.2)` describe block:

- Appends `:::composite` class to composite nodes only
- Emits `classDef composite` when at least one composite node exists
- Does NOT emit `classDef composite` when no composite nodes
- Emits `classDef composite` exactly once even with multiple composites
- Output with composite nodes passes `validateMermaidSyntax`
- Non-composite nodes are unaffected (no `:::composite`, no `classDef`)

### Completion Notes

- All 618 tests pass (0 regressions, 6 new passing tests)
- ESLint: 0 errors, 0 warnings on changed files
- TypeScript errors noted are pre-existing in unrelated files (Zod API changes in route.ts files)
- The `classDef` line is emitted only for `flowchart` diagrams (the only diagram type with `:::class` support in Mermaid); stateDiagram and sequenceDiagram converters are unmodified
- `injectLayerBadges` is called in the same `useEffect` as `injectBadges` so they share the same render-generation trigger — layer badges re-inject whenever the SVG re-renders

### File List

- `src/lib/json2mermaid/types.ts` — modified (added `type`, `childGraphId` to `GraphNode`)
- `src/lib/json2mermaid/flowchart.ts` — modified (`:::composite` class + `classDef` emission)
- `src/lib/svg/badge-renderer.ts` — modified (added `injectLayerBadges` export)
- `src/components/diagram/MermaidPreview.tsx` — modified (composite hover CSS + `injectLayerBadges` call)
- `src/__tests__/generate-flow-ai.test.ts` — modified (6 new composite node tests)

### Change Log

- 2026-03-04: Story 9.2 implemented — composite node rendering with `:::composite` class, `classDef` declaration, layer indicator SVG badge, and indigo glow hover effect.
