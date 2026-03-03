# Story 7.3 — Live Review Indicators

## Status: review

## Story

**As a** Product Manager,
**I want** to see colored badges on diagram nodes that indicate potential issues,
**so that** I can instantly see where risks and edge cases exist without opening a review panel.

## Acceptance Criteria

1. **Given** a diagram has been generated or modified
   **When** the live review graph completes
   **Then** nodes with identified issues display a colored badge (green=ok, yellow=medium, red=high/critical)

2. **Given** a node has a review badge
   **When** the PM hovers over the badge
   **Then** a tooltip shows a brief summary of the issue

3. **Given** a node has a review badge
   **When** the PM clicks the badge
   **Then** the full review detail appears (description, severity, suggestions)

## Technical Notes

- **Live review graph**: `[extract-nodes] → [review (LLMNode)] → [map-annotations] → END`
- Runs asynchronously after each diagram update (debounced 2s)
- Annotations stored as `{ nodeId, severity, message }[]`
- Rendered as SVG overlays on the diagram

### Graph design

```
live-review.graph
┌───────────────┐     ┌────────────────────┐     ┌──────────────────┐
│ extract-nodes │────▶│ review (LLMNode)   │────▶│ map-annotations  │──▶ END
│ (pure fn)     │     │ (Claude, streaming)│     │ (pure fn)        │
└───────────────┘     └────────────────────┘     └──────────────────┘
```

- `extract-nodes`: receives `JsonGraph`, returns `{ nodes: { id, label }[] }`
- `review (LLMNode)`: sends node list to Claude; streams back JSON array `AnnotationRaw[]`
- `map-annotations`: maps raw LLM output to `Annotation[]` (validates nodeId against graph, coerces severity)

### Data types

```ts
type Severity = 'ok' | 'medium' | 'high' | 'critical';

interface Annotation {
  nodeId: string; // matches JsonGraph node id
  severity: Severity;
  message: string; // one-line summary (≤120 chars)
  description?: string; // longer explanation
  suggestions?: string[];
}
```

### Badge rendering (SVG overlay)

- After `mermaid.render()` completes, iterate `annotations` and overlay a `<circle>` + text badge on each affected node's `<g>` element
- Badge position: top-right corner of the node bounding box (`getBBox()`)
- Badge colors: `ok` → `#22c55e`, `medium` → `#eab308`, `high` → `#f97316`, `critical` → `#ef4444`
- Badge is an SVG `<g class="review-badge">` injected directly into the diagram SVG
- Tooltip on hover: CSS `title` element on the badge group (native SVG tooltip) + custom positioned `<div>` for richer content
- Click: dispatches a custom event `review-badge-click` caught by parent component to open detail panel

### Debounce & async flow

1. `DiagramPreviewPanel` (or `StudioLayout`) watches `graph` prop changes
2. On change, schedules `triggerLiveReview()` with 2s debounce (cancel pending if new change arrives)
3. `triggerLiveReview()` posts to `POST /api/ai/live-review` with `{ workspaceId, graph }`
4. API route runs the live-review graph and streams `Annotation[]` back as SSE
5. Client collects annotations, stores in React state, passes to `MermaidPreview` as `annotations` prop
6. `MermaidPreview` re-applies badge overlays whenever `annotations` changes (without full re-render)

## Dev Notes

### New files to create

- `src/lib/ai/graphs/live-review.graph.ts`
  - Exports `runLiveReview(graph: JsonGraph): Promise<Annotation[]>`
  - Implements `[extract-nodes] → [review (LLMNode)] → [map-annotations]` pipeline
  - LLM prompt instructs Claude to return a JSON array of `AnnotationRaw[]`
  - Includes JSON schema validation on the LLM output before mapping

- `src/lib/svg/badge-renderer.ts`
  - `injectBadges(svgRoot: SVGSVGElement, annotations: Annotation[]): void`
    - Clears all existing `.review-badge` elements
    - For each annotation, finds node `<g>` by mapped SVG id (reuses `mapSvgNodeId` from Story 7.1)
    - Computes `getBBox()`, places a `<circle r="8">` at `(bbox.x + bbox.width, bbox.y)`
    - Adds a `<text>` with severity initial (●) inside circle
    - Injects `<title>` for native tooltip
  - `clearBadges(svgRoot: SVGSVGElement): void` — removes all `.review-badge` groups

- `src/app/api/ai/live-review/route.ts`
  - `POST` handler: validates body `{ workspaceId, graph }`, calls `runLiveReview(graph)`, returns `{ annotations: Annotation[] }`
  - Protected by `requireAuth()`, rate-limited via `withAI`

- `src/components/diagram/ReviewBadgeDetail.tsx`
  - Modal/popover that renders the full annotation detail (description + suggestions)
  - Triggered by `review-badge-click` event or by clicking a badge in `MermaidPreview`

### Existing files to modify

- `src/components/diagram/MermaidPreview.tsx`
  - Add `annotations?: Annotation[]` prop
  - After SVG is rendered (and after patch animations from Story 7.2), call `injectBadges(svgRoot, annotations ?? [])`
  - Re-run `injectBadges` whenever `annotations` prop changes (useEffect dependency)
  - Wire up click handler on SVG for `.review-badge` groups → call `onBadgeClick(nodeId)` prop callback

- `src/components/diagram/DiagramPreviewPanel.tsx`
  - Add `annotations` state (`Annotation[]`)
  - Add `onBadgeClick(nodeId)` handler → set selected annotation → open `ReviewBadgeDetail`
  - Pass `annotations` and `onBadgeClick` down to `MermaidPreview`

- `src/components/studio/StudioLayout.tsx` (or equivalent orchestrator)
  - Import `runLiveReview` indirectly (via API call, not direct import on client)
  - Add debounce logic (2s) watching `graph` state
  - On debounce trigger: call `POST /api/ai/live-review`, update `annotations` state

### LLM Prompt (live-review node)

```
You are a product process analyst reviewing a business flow diagram.
Given the following list of nodes (each with an id and a label), identify potential issues,
missing edge cases, or risks for each node that warrants attention.

Nodes:
{{nodes}}

Return a JSON array. Each element must have:
- "nodeId": the exact node id from the input
- "severity": one of "ok" | "medium" | "high" | "critical"
- "message": a single sentence (max 120 chars) summarizing the issue
- "description": optional, longer explanation
- "suggestions": optional array of actionable suggestions

Return ONLY the JSON array, no markdown, no commentary.
Omit nodes that have no issues (severity "ok" entries are optional).
```

### No new Prisma model needed

Annotations are ephemeral (per-session, in React state). No DB persistence for this story.

## Tasks

- [x] Create `src/lib/ai/graphs/live-review.graph.ts` with the 3-node pipeline
- [x] Create `src/lib/svg/badge-renderer.ts` with `injectBadges` / `clearBadges`
- [x] Create `src/app/api/ai/live-review/route.ts`
- [x] Create `src/components/diagram/ReviewBadgeDetail.tsx`
- [x] Modify `MermaidPreview.tsx` — add `annotations` prop + badge injection + click handler
- [x] Modify `DiagramPreviewPanel.tsx` — annotations state + badge click → detail panel
- [x] Modify `StudioLayout.tsx` — debounced live-review trigger on graph changes
- [x] Manual test: generate a flow, wait 2s, verify badges appear on nodes with issues
- [x] Manual test: hover badge → tooltip visible; click badge → detail panel opens

## Dev Agent Record

### Implementation Plan

Implemented the full live-review pipeline in 4 layers:

1. **AI Graph** (`live-review.graph.ts`): 3-node claudegraph pipeline — `extract-nodes` (FnNode) extracts `{ id, label }[]` from JsonGraph → `review` (LLMNode with AnnotationRawSchema) calls Claude to identify issues → `map-annotations` (FnNode) validates nodeIds and filters ok-severity entries.

2. **SVG Renderer** (`badge-renderer.ts`): `injectBadges` iterates annotations, finds each node `<g>` via `mapSvgNodeId`, computes `getBBox()`, overlays a colored `<circle r="8">` + `!` text + `<title>` tooltip. Fires `review-badge-click` CustomEvent on badge click. `clearBadges` removes all `.review-badge` groups before re-injection.

3. **API Route** (`/api/ai/live-review`): POST endpoint protected by `requireAuth` + `withAI` rate-limiting. Validates request with Zod, calls `runLiveReview(graph)`, returns `{ annotations }`.

4. **React Layer**: `MermaidPreview` gains `annotations`/`onBadgeClick` props — badges injected after render + in a separate `useEffect` for annotation-only updates. `DiagramPreviewPanel` owns `selectedAnnotation` state and renders `ReviewBadgeDetail` on badge click. `StudioLayout` holds `annotations` state + 2s debounced `useEffect` on `diagramContent` to call the live-review API.

### Completion Notes

- All 9 tasks implemented.
- TypeScript: 0 errors in new/modified files. Pre-existing errors in other routes unaffected.
- ESLint: 0 errors (1 pre-existing-style warning for `_userId` parameter).
- `Annotation` and `Severity` types exported from `live-review.graph.ts` and re-exported via `graphs/index.ts`.
- Live review is best-effort: API errors are silently ignored to avoid disrupting the main diagram workflow.
- The `annotations` dependency was added to the main render `useEffect` to ensure fresh badge state after re-renders.

## File List

### New files

- `src/lib/ai/graphs/live-review.graph.ts`
- `src/lib/svg/badge-renderer.ts`
- `src/app/api/ai/live-review/route.ts`
- `src/components/diagram/ReviewBadgeDetail.tsx`

### Modified files

- `src/lib/ai/graphs/index.ts` — export live-review graph and types
- `src/components/diagram/MermaidPreview.tsx` — annotations prop, badge injection, onBadgeClick
- `src/components/studio/DiagramPreviewPanel.tsx` — annotations prop, badge click → ReviewBadgeDetail
- `src/components/studio/StudioLayout.tsx` — annotations state, debounced live-review trigger

## Change Log

- 2026-03-03: Story 7.3 implemented — Live Review Indicators. Added live-review claudegraph pipeline, SVG badge renderer, API route, ReviewBadgeDetail component, and wired the full stack through MermaidPreview → DiagramPreviewPanel → StudioLayout with 2s debounce.
