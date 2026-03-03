# Story 8.2 — Canvas Renderer

## Status: review

## Story

**As a** Product Manager,
**I want** a free-form canvas where I can pan, zoom, and arrange my design artifacts spatially,
**so that** I can organize my product design thinking in a way that makes sense to me.

## Acceptance Criteria

1. **Given** a workspace with multiple artifacts
   **When** the PM opens the canvas view
   **Then** all artifacts are rendered at their stored positions on an infinite canvas

2. **Given** the canvas is active
   **When** the PM drags an artifact
   **Then** it moves smoothly and its position is persisted (PATCH /api/workspaces/[workspaceId]/canvas/artifacts/[artifactId])

3. **Given** the canvas is active
   **When** the PM scrolls or pinches
   **Then** the canvas pans and zooms smoothly

## Technical Notes

### Overview

Story 8.2 introduces a new canvas route (`/workspace/[id]/canvas`) that renders all `CanvasArtifact` rows (from Story 8.1) as draggable cards on an infinite panning / zooming surface.

The existing studio route (`/workspace/[id]/studio`) is left untouched. The canvas is a **parallel view**, not a replacement.

### Canvas architecture

The infinite canvas is implemented with a single `<div>` (the **viewport**) that captures pointer events, and a child `<div>` (the **world**) that is scaled and translated via a CSS `transform: translate(…) scale(…)`. This avoids the need for a heavy canvas library.

```
<div class="canvas-viewport" onPointerDown onPointerMove onPointerUp onWheel>
  <div class="canvas-world" style="transform: translate(Xpx, Ypx) scale(Z)">
    {artifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)}
  </div>
</div>
```

**Pan**: on viewport `pointerdown` (not on a card), track delta and update `translate`.
**Zoom**: on `wheel` (deltaY, or pinch via `ctrlKey` flag), clamp scale to `[0.15, 3]`, zoom toward cursor.
**Drag**: on card `pointerdown`, capture pointer and track delta; on `pointerup` PATCH position.

### New components

#### `src/components/canvas/CanvasView.tsx` (client component)

Top-level canvas component. Responsibilities:

- Fetch `GET /api/workspaces/[workspaceId]/canvas` on mount → populate `artifacts` state.
- Maintain `pan: { x: number; y: number }` and `zoom: number` in local state.
- Handle viewport `wheel` event for pan (no modifier) and zoom (`ctrlKey` / pinch).
- Handle viewport `pointerdown` (on blank area) for pan drag.
- Render `<ArtifactCard>` for each artifact.
- Expose `onArtifactMove(id, newPosition)` callback → optimistic state update + PATCH.

#### `src/components/canvas/ArtifactCard.tsx` (client component)

Renders a single artifact card at its absolute position inside the world div.

```tsx
interface ArtifactCardProps {
  artifact: CanvasArtifact;
  onDragEnd: (id: string, x: number, y: number) => void;
}
```

- Positioned with `position: absolute; left: artifact.position.x; top: artifact.position.y`.
- Width / height from `artifact.position.width / height`.
- On `pointerdown` capture pointer; on `pointermove` update position (world-space delta = screen delta / zoom); on `pointerup` release pointer and call `onDragEnd`.
- Stop propagation so viewport pan doesn't fire simultaneously.
- Renders a header (artifact type icon + title) and a content area (type-specific preview — see below).

#### Content previews (inside ArtifactCard)

| Artifact type  | Preview                                    |
| -------------- | ------------------------------------------ |
| `conversation` | Static placeholder — "Chat" icon + label   |
| `diagram`      | Static placeholder — "Flow" icon + label   |
| `review`       | Static placeholder — "Review" icon + label |
| `spec`         | Static placeholder — "Spec" icon + label   |
| `story`        | Static placeholder — "Story" icon + label  |
| `note`         | Static placeholder — "Note" icon + label   |

Full live previews are deferred to later stories. This story ships icon-only placeholders to keep scope focused.

### New page route

#### `src/app/(dashboard)/workspace/[id]/canvas/page.tsx`

```tsx
import { CanvasView } from '@/components/canvas/CanvasView';

export default async function CanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CanvasView workspaceId={id} />;
}
```

The existing `workspace/[id]/studio/layout.tsx` sets up a full-bleed layout; the canvas page reuses the same parent layout (`workspace/[id]/layout.tsx`).

### Canvas state hook

Extract pan/zoom logic into `src/hooks/useCanvasViewport.ts`:

```ts
export function useCanvasViewport() {
  // pan: {x, y} in screen pixels
  // zoom: scale factor
  // handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp }
  // worldTransform: CSS transform string
}
```

This keeps `CanvasView.tsx` focused on data fetching and artifact rendering.

### Persistence

Drag-end fires a PATCH to `/api/workspaces/[workspaceId]/canvas/artifacts/[artifactId]` with body `{ x, y }`. This route already exists from Story 8.1.

The PATCH is fire-and-forget (no await blocking UI). On fetch error, a `toast.error` is shown but the optimistic position is retained (user can retry by dragging again).

### Styling

- Viewport: `w-full h-full overflow-hidden cursor-grab` (cursor changes to `cursor-grabbing` during pan, `cursor-default` during card drag).
- World div: `position: relative; transform-origin: 0 0`.
- ArtifactCard: `absolute rounded-lg border border-border bg-card shadow-md select-none`.
- Card header: `flex items-center gap-2 px-3 py-2 border-b border-border text-sm font-medium`.
- Card body: `p-3 text-muted-foreground text-xs flex items-center justify-center gap-2`.

### No new Prisma changes

All data access goes through the REST API routes from Story 8.1. No schema changes.

## Dev Notes

### New files to create

- `src/components/canvas/CanvasView.tsx` — main canvas client component
- `src/components/canvas/ArtifactCard.tsx` — draggable artifact card
- `src/hooks/useCanvasViewport.ts` — pan/zoom state + event handlers
- `src/app/(dashboard)/workspace/[id]/canvas/page.tsx` — Next.js page

### Existing files to modify

None required. The canvas is a new parallel route.

### Pointer event handling details

Use `setPointerCapture` / `releasePointerCapture` on drag start/end so moves stay responsive if the cursor leaves the element:

```ts
e.currentTarget.setPointerCapture(e.pointerId);
// on pointerup:
e.currentTarget.releasePointerCapture(e.pointerId);
```

### Zoom toward cursor formula

```ts
const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
const newZoom = clamp(zoom * zoomFactor, 0.15, 3);
// Adjust pan so the point under the cursor stays fixed:
const cursorX = e.clientX - viewportRect.left;
const cursorY = e.clientY - viewportRect.top;
const newPanX = cursorX - (cursorX - pan.x) * (newZoom / zoom);
const newPanY = cursorY - (cursorY - pan.y) * (newZoom / zoom);
```

### Touch / trackpad pinch

Modern browsers fire `wheel` events with `ctrlKey: true` for pinch gestures. No separate touch handler needed for zoom. Two-finger scroll fires regular `wheel` events.

### TypeScript

All new components use strict TypeScript. `CanvasArtifact` and `CanvasState` types are imported from `src/lib/canvas/types.ts` (Story 8.1).

## Tasks

- [x] Create `src/hooks/useCanvasViewport.ts` with pan/zoom state and event handlers
- [x] Create `src/components/canvas/ArtifactCard.tsx` with drag-and-drop support
- [x] Create `src/components/canvas/CanvasView.tsx` fetching canvas state and rendering cards
- [x] Create `src/app/(dashboard)/workspace/[id]/canvas/page.tsx`
- [x] Manual test: open canvas → artifacts appear at stored positions
- [x] Manual test: drag artifact → card moves smoothly, PATCH fired, position persisted on reload
- [x] Manual test: scroll → canvas pans; Ctrl+scroll / pinch → canvas zooms toward cursor
- [x] TypeScript: 0 new errors (`npx tsc --noEmit`)
- [x] ESLint: 0 errors on new files (`npx eslint src/components/canvas/ src/hooks/useCanvasViewport.ts`)

## Dev Agent Record

### Implementation Plan

Implemented the canvas renderer in 4 layers:

1. **`src/hooks/useCanvasViewport.ts`** — Pure pan/zoom state hook.
   - `pan: {x,y}` and `zoom` in React state.
   - `onWheel`: `ctrlKey` → zoom toward cursor (zoom-toward-cursor formula); no modifier → translate pan by `deltaX/Y`.
   - `onPointerDown/Move/Up` on viewport: pan drag using `setPointerCapture`; only activates when `e.target === e.currentTarget` (blank area).
   - Zoom clamped to `[0.15, 3]`.
   - Returns `worldTransform` CSS string + `viewportRef`.

2. **`src/components/canvas/ArtifactCard.tsx`** — Draggable artifact card.
   - Positioned `absolute` at `{left: position.x, top: position.y}`, sized from `position.width/height`.
   - Local position state for smooth optimistic drag; world-space delta = screen delta / zoom.
   - `setPointerCapture` on drag start, `releasePointerCapture` on drop.
   - `e.stopPropagation()` prevents viewport pan from firing simultaneously.
   - Type-specific icon + label placeholders via `TYPE_META` lookup table.

3. **`src/components/canvas/CanvasView.tsx`** — Top-level canvas client component.
   - Fetches `GET /api/workspaces/[workspaceId]/canvas` on mount; shows `Loader2` spinner during load.
   - Dot-grid background (decorative, `pointer-events-none`).
   - World div: `position: absolute; transform-origin: 0 0` with `worldTransform` applied.
   - `handleDragEnd` → optimistic `setCanvasState` + fire-and-forget PATCH; `toast.error` on fetch failure.

4. **`src/app/(dashboard)/workspace/[id]/canvas/page.tsx`** — Next.js async page component wrapping `<CanvasView>`.

### Completion Notes

- All 9 tasks implemented and checked.
- TypeScript: 0 new errors (6 pre-existing in unrelated files unchanged).
- ESLint: 0 errors on all new files.
- Tests: 612/612 pass (no regressions).
- No new dependencies introduced.
- AC1: artifacts fetched from API and rendered at stored positions on infinite canvas. ✅
- AC2: drag updates local position smoothly; `onPointerUp` fires PATCH to persist. ✅
- AC3: wheel pans (no modifier) or zooms toward cursor (ctrlKey/pinch); trackpad pinch handled natively via `wheel + ctrlKey`. ✅

## File List

### New files

- `src/hooks/useCanvasViewport.ts`
- `src/components/canvas/ArtifactCard.tsx`
- `src/components/canvas/CanvasView.tsx`
- `src/app/(dashboard)/workspace/[id]/canvas/page.tsx`

### Modified files

_(none — canvas is a new parallel route)_

## Change Log

- 2026-03-03: Story 8.2 created — Canvas Renderer (CanvasView, ArtifactCard, useCanvasViewport, canvas page route).
- 2026-03-03: Story 8.2 implemented — useCanvasViewport hook, ArtifactCard with pointer-capture drag, CanvasView with optimistic persistence, canvas page route. 612/612 tests pass.
