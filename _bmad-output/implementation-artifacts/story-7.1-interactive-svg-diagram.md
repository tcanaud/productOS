# Story 7.1 — Interactive SVG Diagram

## Status: review

## Story

**As a** Product Manager,
**I want** to click on nodes and edges in my diagram to trigger contextual actions,
**so that** I can interact with my design visually instead of only through chat.

## Acceptance Criteria

1. **Given** a rendered Mermaid diagram
   **When** the PM hovers over a node
   **Then** the node visually highlights (border glow or color shift)

2. **Given** a rendered Mermaid diagram
   **When** the PM clicks a node
   **Then** a context menu appears with actions relevant to that node

3. **Given** the PM clicks an edge
   **When** the edge is selected
   **Then** edge-specific actions are available (e.g. "Add condition", "Remove connection")

## Technical Notes

- Mermaid renders to SVG — parse the SVG DOM to attach `mouseenter`, `mouseleave`, and `click` handlers to node/edge `<g>` elements
- Map SVG element IDs back to JsonGraph node/edge IDs via the `id` attribute Mermaid embeds (e.g. `flowchart-A-0` → node `A`)
- Use `mermaid.render()` output + post-processing (inject handlers after `innerHTML = svg`)
- Context menu rendered as a Radix UI `DropdownMenu` (or a positioned `<div>`) anchored to click coordinates
- Edge elements in Mermaid SVG are `.edgePath` / `.edgeLabel` `<g>` elements; nodes are `.node` `<g>` elements
- No new Prisma model needed — interactions are frontend-only; actions call existing chat/refine endpoints

## Dev Notes

### Existing Components to Modify

- `src/components/diagram/MermaidPreview.tsx` — currently renders SVG then sets `innerHTML`. Needs to:
  1. After setting `innerHTML`, query the SVG for node and edge elements
  2. Attach hover and click handlers to each
  3. Expose `onNodeClick(nodeId: string, pos: {x,y})` and `onEdgeClick(edgeId: string, pos: {x,y})` callbacks
- `src/components/studio/DiagramPreviewPanel.tsx` — passes `MermaidPreview` props; needs to handle click callbacks and render the context menu overlay

### New Files

- `src/lib/svg/svg-id-mapper.ts` — pure utility: `mapSvgNodeId(svgId: string) → string` extracts the JsonGraph node ID from a Mermaid SVG element ID
  - Mermaid flowchart node IDs follow pattern `flowchart-{nodeId}-{index}` → extract `nodeId`
  - Edge IDs follow pattern `L-{fromId}-{toId}-{index}` or class `edgePath` → derive `from`/`to`
- `src/components/diagram/DiagramContextMenu.tsx` — floating context menu component:
  - Props: `type: 'node' | 'edge'`, `nodeId?: string`, `edgeFrom?: string`, `edgeTo?: string`, `position: {x, y}`, `onAction(action: DiagramAction)`, `onClose()`
  - Node actions: `"rename"`, `"add-child"`, `"add-parent"`, `"remove-node"`, `"explain-node"`
  - Edge actions: `"add-condition"`, `"remove-connection"`, `"reverse-direction"`
  - Renders as an absolutely-positioned card with shadcn/ui `Button` items; closes on outside click or Escape

### Types

```typescript
export type DiagramAction =
  | { type: 'rename'; nodeId: string }
  | { type: 'add-child'; nodeId: string }
  | { type: 'add-parent'; nodeId: string }
  | { type: 'remove-node'; nodeId: string }
  | { type: 'explain-node'; nodeId: string }
  | { type: 'add-condition'; from: string; to: string }
  | { type: 'remove-connection'; from: string; to: string }
  | { type: 'reverse-direction'; from: string; to: string };
```

### Hover Highlight Implementation

- On `mouseenter` for a `.node` `<g>`: add CSS class `diagram-node-hover` which applies `filter: drop-shadow(0 0 6px #6366f1)` and `cursor: pointer`
- On `mouseleave`: remove class
- CSS injected via a `<style>` tag appended to the SVG after render (avoids Tailwind purge)

### Context Menu Positioning

- On `click`, call `event.stopPropagation()` and record `clientX / clientY` relative to the diagram container
- Pass position to `DiagramContextMenu` which renders as `position: fixed` at those coordinates
- A transparent full-screen overlay (lower z-index) closes the menu on outside click

### Action Dispatch

- `"explain-node"` / `"rename"` / structural actions → dispatch to the studio chat (pre-fill the user input with a natural-language command, e.g. `"Rename node 'Payment' to 'Checkout'"`)
- Future: direct JSON patch for structural actions (Story 7.2+)

## Tasks

### Task 1 — SVG ID mapper utility

- [x] Create `src/lib/svg/svg-id-mapper.ts` with `mapSvgNodeId(svgId: string): string | null`
- [x] Handle flowchart node pattern: `flowchart-{nodeId}-{index}` → `nodeId`
- [x] Handle edge class-based detection (`.edgePath` elements)
- [x] Write unit tests in `src/__tests__/svg/svg-id-mapper.test.ts`

### Task 2 — MermaidPreview: attach SVG interactivity

- [x] Update `MermaidPreview.tsx` to accept `onNodeClick` and `onEdgeClick` optional callback props
- [x] After `innerHTML = svg`, query `.node` elements and attach `mouseenter`, `mouseleave`, `click`
- [x] Query `.edgePath` elements and attach `click` handler
- [x] Inject hover CSS `<style>` tag into the rendered SVG
- [x] Map SVG element IDs to JsonGraph IDs via `mapSvgNodeId`

### Task 3 — DiagramContextMenu component

- [x] Create `src/components/diagram/DiagramContextMenu.tsx`
- [x] Render node-specific actions for `type: 'node'`
- [x] Render edge-specific actions for `type: 'edge'`
- [x] Close on Escape key and outside click
- [x] Call `onAction(action)` and then `onClose()` when an action is selected

### Task 4 — DiagramPreviewPanel: wire up interactivity

- [x] Update `DiagramPreviewPanel.tsx` to handle `onNodeClick` / `onEdgeClick` from `MermaidPreview`
- [x] Track `contextMenu` state: `{ type, id, position } | null`
- [x] Render `DiagramContextMenu` when `contextMenu !== null`
- [x] Expose `onDiagramAction` prop for parent to receive dispatched actions

### Task 5 — Tests

- [x] Unit: `svg-id-mapper` — extracts correct nodeId from Mermaid SVG element IDs
- [x] Unit: `DiagramContextMenu` — renders node actions, renders edge actions, calls onClose on Escape
- [x] Unit: `MermaidPreview` — `onNodeClick` callback is invoked when a node `<g>` is clicked (jsdom)

## Definition of Done

- [x] Hovering a node shows a visual highlight (glow / color shift)
- [x] Clicking a node opens a context menu with node-specific actions
- [x] Clicking an edge opens a context menu with edge-specific actions
- [x] Context menu closes on Escape or outside click
- [x] `mapSvgNodeId` correctly maps Mermaid SVG IDs → JsonGraph node IDs
- [x] All tasks checked off

## Dev Agent Record

### Implementation Plan

1. Created `src/lib/svg/svg-id-mapper.ts` — pure utilities `mapSvgNodeId`, `mapSvgEdgeId`, `isSvgNodeElement`, `isSvgEdgeElement`. Pattern-matches Mermaid's SVG ID conventions.
2. Updated `src/components/diagram/MermaidPreview.tsx`:
   - Added `ClickPosition` type export and `onNodeClick` / `onEdgeClick` optional props
   - After `innerHTML = svg`: injects a `<style>` tag with hover CSS into the SVG
   - Queries `g.node` elements → attaches `mouseenter`/`mouseleave` (toggle `diagram-node-hover` class) + `click` (calls `onNodeClick` with mapped nodeId)
   - Queries `g.edgePath` elements → attaches `mouseenter`/`mouseleave` (toggle `diagram-edge-hover`) + `click` (calls `onEdgeClick` with from/to)
3. Created `src/components/diagram/DiagramContextMenu.tsx`:
   - `DiagramAction` union type exported for action dispatch
   - Discriminated union props: `type: 'node'` with `nodeId` / `type: 'edge'` with `edgeFrom` + `edgeTo`
   - Full-screen transparent backdrop closes menu on outside click
   - `useEffect` listens for Escape key → calls `onClose`
   - Node actions: Explain, Rename, Add child, Add parent, Remove (destructive)
   - Edge actions: Add condition, Reverse direction, Remove connection (destructive)
4. Updated `src/components/studio/DiagramPreviewPanel.tsx`:
   - Added `useState<ContextMenuState>` for context menu lifecycle
   - `useCallback` handlers `handleNodeClick` / `handleEdgeClick` / `handleAction` / `closeMenu`
   - Passes callbacks to `<MermaidPreview>`
   - Renders `<DiagramContextMenu>` when `contextMenu !== null`
   - Exposes `onDiagramAction` prop for parent component integration
5. Tests (35 new tests across 3 files):
   - `src/__tests__/svg/svg-id-mapper.test.ts` — 21 tests
   - `src/__tests__/diagram/DiagramContextMenu.test.tsx` — 10 tests
   - `src/__tests__/diagram/MermaidPreview.test.tsx` — 4 tests (mermaid mocked)

### Completion Notes

- All 593 tests pass (32 test files). 35 new tests added for Story 7.1.
- No TypeScript errors introduced (pre-existing ZodError errors from earlier stories unchanged).
- ESLint passes on all new/modified files.
- Hover highlight uses CSS `filter: drop-shadow(0 0 6px #6366f1)` injected as an SVG `<style>` element — survives Tailwind purge and Shadow DOM boundaries.
- Context menu positioned with `position: fixed` at `clientX/clientY` — works correctly regardless of scroll position.

### Files Changed

- `src/lib/svg/svg-id-mapper.ts` — new: `mapSvgNodeId`, `mapSvgEdgeId`, `isSvgNodeElement`, `isSvgEdgeElement`
- `src/components/diagram/MermaidPreview.tsx` — updated: added `ClickPosition` type, `onNodeClick`/`onEdgeClick` props, SVG post-processing, hover CSS injection
- `src/components/diagram/DiagramContextMenu.tsx` — new: `DiagramAction` type, `DiagramContextMenu` component
- `src/components/studio/DiagramPreviewPanel.tsx` — updated: added context menu state, `onDiagramAction` prop, wired interactivity
- `src/__tests__/svg/svg-id-mapper.test.ts` — new: 21 unit tests
- `src/__tests__/diagram/DiagramContextMenu.test.tsx` — new: 10 component tests
- `src/__tests__/diagram/MermaidPreview.test.tsx` — new: 4 component tests

### Change Log

- 2026-03-03: Implemented Story 7.1 — Interactive SVG Diagram. Added SVG ID mapper, MermaidPreview interactivity (hover highlight + click handlers), DiagramContextMenu (node and edge actions), DiagramPreviewPanel context menu wiring. 35 new tests.
