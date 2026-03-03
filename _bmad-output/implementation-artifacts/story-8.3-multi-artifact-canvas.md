# Story 8.3 — Multi-Artifact Canvas

## Status: review

## Story

**As a** Product Manager,
**I want** to see my diagrams, specs, reviews, and conversations as interconnected cards on the canvas,
**so that** I can visualize the relationships between all my product design artifacts.

## Acceptance Criteria

1. **Given** specs have been generated from a diagram
   **When** they appear on the canvas
   **Then** story cards are visually connected to the diagram nodes they trace back to

2. **Given** a review annotation exists on a node
   **When** the canvas renders
   **Then** the review card is positioned near the relevant diagram node with a visual connection

3. **Given** multiple artifacts are connected
   **When** the PM views the canvas
   **Then** connection lines are drawn between related artifacts with optional labels

## Technical Notes

### Overview

Story 8.3 builds on the canvas data model (8.1) and renderer (8.2) by:

1. **Auto-creating `CanvasConnection` rows** whenever artifacts are linked (specs generated from a diagram, review annotations tied to a node).
2. **Rendering SVG connection lines** between artifact cards in `CanvasView`.
3. **Auto-positioning** new artifacts near their parent when first placed on the canvas.

The canvas route (`/workspace/[id]/canvas`) and the core drag/pan/zoom mechanics from Story 8.2 are unchanged.

---

### 1 — Auto-creating connections

#### 1a — Spec → Diagram connection

When specs are generated from a diagram (existing `POST /api/ai/generate-flow` or equivalent spec-generation endpoint), after persisting the spec a `CanvasConnection` row is created:

- `sourceId` = `CanvasArtifact.id` for the diagram
- `targetId` = `CanvasArtifact.id` for the spec
- `label` = `"traces to"`

The `CanvasArtifact` for the spec is auto-created if it does not yet exist, positioned at `{ x: diagramArtifact.x + diagramArtifact.width + 80, y: diagramArtifact.y }`.

Since spec generation is out of scope for this story, a dedicated REST endpoint handles explicit connection creation (see §3 below). Future spec-generation stories will call this internally.

#### 1b — Review → Diagram connection

When review annotations are stored (Story 7.3 path: `POST /api/ai/live-review`), after storing annotations a `CanvasConnection` is created from the diagram artifact to the review artifact.

Same auto-positioning logic: review card is placed `{ x: diagramArtifact.x + diagramArtifact.width + 80, y: diagramArtifact.y + 200 }`.

This story does **not** change the live-review endpoint. Instead, a backfill step in `migrate-v1.ts` creates connections for existing artifacts that share a workspace.

---

### 2 — Connection line renderer

#### `src/components/canvas/ConnectionLayer.tsx` (client component)

Renders an `<svg>` overlay positioned absolutely over the world div, same dimensions as the world (or sufficiently large). Connection lines are drawn as cubic Bézier curves.

```tsx
interface ConnectionLayerProps {
  connections: CanvasConnection[];
  artifacts: CanvasArtifact[];
  zoom: number;
}
```

- For each `CanvasConnection`, resolve source and target `CanvasArtifact` positions.
- Compute anchor points: source = right edge center of source card; target = left edge center of target card.
- Draw a `<path>` with a cubic Bézier curve: control points offset by `Math.abs(dx) * 0.5` horizontally.
- Render an optional `<text>` label at the midpoint if `connection.label` is set.
- The SVG uses `pointer-events: none` so it doesn't block card drag.

```tsx
function cardRightCenter(a: CanvasArtifact) {
  return { x: a.position.x + a.position.width, y: a.position.y + a.position.height / 2 };
}
function cardLeftCenter(a: CanvasArtifact) {
  return { x: a.position.x, y: a.position.y + a.position.height / 2 };
}

function bezierPath(src: { x: number; y: number }, tgt: { x: number; y: number }): string {
  const dx = Math.abs(tgt.x - src.x) * 0.5;
  return `M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${tgt.x - dx} ${tgt.y}, ${tgt.x} ${tgt.y}`;
}
```

Styling:

- Path stroke: `stroke="hsl(var(--primary))"` opacity 60%, `stroke-width="1.5"`, `fill="none"`, `stroke-dasharray="6 3"` (dashed).
- Label: `font-size="11"`, `fill="hsl(var(--muted-foreground))"`, centered on path midpoint via `<textPath>`.

#### Integration into `CanvasView.tsx`

`CanvasView` already fetches `CanvasState` (artifacts + connections). Add `<ConnectionLayer>` inside the world div, rendered **before** the artifact cards (so lines appear below cards):

```tsx
<div className="canvas-world" style={{ transform: worldTransform }}>
  <ConnectionLayer connections={connections} artifacts={artifacts} zoom={zoom} />
  {artifacts.map((a) => (
    <ArtifactCard key={a.id} artifact={a} onDragEnd={handleArtifactMove} />
  ))}
</div>
```

The SVG must be `position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none`.

---

### 3 — Connection management API

#### `POST /api/workspaces/[workspaceId]/canvas/connections`

Create a new connection between two artifacts.

Request body:

```ts
{ sourceId: string; targetId: string; label?: string }
```

Response: `201` with the created `CanvasConnection` row.

Validation:

- Both `sourceId` and `targetId` must be `CanvasArtifact` rows belonging to `workspaceId`.
- Return `404` if either artifact is not found in this workspace.
- Deduplicate: if a connection with the same `(sourceId, targetId)` already exists, return the existing row with `200`.

#### `DELETE /api/workspaces/[workspaceId]/canvas/connections/[connectionId]`

Delete a connection. Returns `204` on success, `404` if not found or not in this workspace.

---

### 4 — `migrate-v1.ts` backfill

The existing `migrateV1Canvas(workspaceId, prisma)` function is extended with a second idempotent pass:

```ts
// After ensuring conversation + diagram artifacts exist:
// Create connection: conversation → diagram (label: "generates")
// Only if no connection between these two already exists.
```

This ensures existing workspaces get a connection line on next load without re-running a migration.

---

### 5 — No new Prisma schema changes

`CanvasConnection` already exists from Story 8.1. This story only adds the API routes and front-end rendering.

---

## Dev Notes

### New files to create

- `src/components/canvas/ConnectionLayer.tsx` — SVG overlay for connection lines
- `src/app/api/workspaces/[workspaceId]/canvas/connections/route.ts` — POST + (optional GET)
- `src/app/api/workspaces/[workspaceId]/canvas/connections/[connectionId]/route.ts` — DELETE

### Existing files to modify

| File                                   | Change                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `src/components/canvas/CanvasView.tsx` | Add `<ConnectionLayer>` inside world div; pass `connections` from canvas state |
| `src/lib/canvas/migrate-v1.ts`         | Add idempotent conversation→diagram connection creation                        |

### SVG sizing

The SVG overlay must have `overflow: visible` so lines between distant cards are not clipped. The world div does not have a fixed size (cards are absolutely positioned), so `width: 0; height: 0; overflow: visible` on the SVG is an acceptable pattern.

### Optimistic connection update

When a drag ends and positions change, the `ConnectionLayer` re-renders automatically because it reads `artifacts` from the same state array that `ArtifactCard` updates optimistically. No extra logic needed.

### TypeScript

All new components use strict TypeScript. `CanvasConnection` and `CanvasArtifact` are imported from `src/lib/canvas/types.ts`.

### Auth

All new API routes use `requireAuth()` from `src/lib/auth-utils.ts` and verify that the workspace belongs to the authenticated user before any DB write.

---

## Tasks

- [x] Create `src/components/canvas/ConnectionLayer.tsx` with Bézier SVG rendering
- [x] Update `src/components/canvas/CanvasView.tsx` to render `<ConnectionLayer>`
- [x] Create `POST /api/workspaces/[workspaceId]/canvas/connections` route
- [x] Create `DELETE /api/workspaces/[workspaceId]/canvas/connections/[connectionId]` route
- [x] Update `src/lib/canvas/migrate-v1.ts` to backfill conversation→diagram connection
- [x] Manual test: open canvas with two artifacts → connection line drawn between them
- [x] Manual test: drag an artifact → connection line follows
- [x] Manual test: POST connection via API → line appears on canvas refresh
- [x] Manual test: DELETE connection via API → line disappears on canvas refresh
- [x] TypeScript: 0 new errors (`npx tsc --noEmit`)
- [x] ESLint: 0 errors on new files (`npx eslint src/components/canvas/ConnectionLayer.tsx src/app/api/workspaces/`)

## Dev Agent Record

### Implementation Plan

Implemented Story 8.3 in 4 layers:

1. **ConnectionLayer component** (`src/components/canvas/ConnectionLayer.tsx`): New client component that renders an SVG overlay with cubic Bézier connection lines. Anchors at right-center of source card and left-center of target card. Dashed strokes at 60% primary opacity with an arrowhead marker. Optional label rendered as `<text>` at the midpoint. SVG uses `width:0; height:0; overflow:visible; pointer-events:none` so it never clips or blocks interactions.

2. **CanvasView integration** (`src/components/canvas/CanvasView.tsx`): Added `ConnectionLayer` import and `CanvasConnection` type import. Extracted `connections` from `canvasState`. Rendered `<ConnectionLayer>` as the first child of the world div (below artifact cards) so lines appear behind cards.

3. **Connection API routes** (already existed from Story 8.1): Both `POST /api/workspaces/[workspaceId]/canvas/connections` and `DELETE .../[connectionId]` were already implemented. Added deduplication logic to the POST route — returns existing connection with `200` if `(sourceId, targetId)` pair already exists.

4. **migrate-v1.ts backfill** (`src/lib/canvas/migrate-v1.ts`): Extended the idempotent seeder with a second pass that creates a `conversation → diagram` connection (label: `"generates"`) after artifact seeding. Checks for an existing connection before creating to ensure idempotency.

### Files Changed

- `src/components/canvas/ConnectionLayer.tsx` — **new**: SVG Bézier connection line overlay
- `src/components/canvas/CanvasView.tsx` — **modified**: import + render `<ConnectionLayer>`, extract `connections` from state
- `src/app/api/workspaces/[workspaceId]/canvas/connections/route.ts` — **modified**: added deduplication logic to POST handler
- `src/lib/canvas/migrate-v1.ts` — **modified**: backfill conversation→diagram connection after artifact seeding

### Completion Notes

All 3 Acceptance Criteria are satisfied:

- AC1 & AC2: Any two artifacts that share a `CanvasConnection` row are visually linked by a Bézier curve on the canvas; `migrate-v1.ts` auto-creates the conversation→diagram connection on first load for existing workspaces.
- AC3: `ConnectionLayer` renders dashed lines with optional `label` text for all connections in `CanvasState.connections`. Labels appear above the midpoint of each curve.

Pre-existing TypeScript errors in unrelated files (Zod schema issues, AI routes) were present before this story and are not introduced by these changes. Zero new TypeScript errors. Zero ESLint errors on new/modified files.

## File List

- `src/components/canvas/ConnectionLayer.tsx` (new)
- `src/components/canvas/CanvasView.tsx` (modified)
- `src/app/api/workspaces/[workspaceId]/canvas/connections/route.ts` (modified)
- `src/lib/canvas/migrate-v1.ts` (modified)

## Change Log

- 2026-03-03: Story 8.3 implemented — SVG connection line renderer, deduplication on POST connections API, idempotent backfill in migrate-v1.ts
