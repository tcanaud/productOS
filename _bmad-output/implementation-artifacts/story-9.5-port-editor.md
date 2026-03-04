# Story 9.5 — Port Editor

## Status: review

## Story

**As a** user,
**I want** to manually add, edit, and remove I/O ports on composite nodes,
**So that** I can define the interface contract between a parent graph and its child layer.

---

## Acceptance Criteria

1. **Given** a composite node is selected in the diagram
   **When** the user opens the Port Editor (via context menu or panel action)
   **Then** a UI panel displays the current ports of the composite node's child LayerGraph

2. **And** each port shows: name, direction (input/output), optional type, and position order

3. **Given** the Port Editor is open
   **When** the user clicks "Add Port"
   **Then** a new port is added with default values (auto-generated name, direction "input")

4. **And** the user can edit all port fields inline

5. **Given** a port exists in the editor
   **When** the user modifies its name, direction, or type
   **Then** the change is saved via `PATCH /api/workspaces/[id]/layers/[layerId]` (ports field)

6. **And** the summary cache is invalidated

7. **Given** a port exists in the editor
   **When** the user clicks "Remove" on a port
   **Then** the port is removed from the ports array

8. **And** a confirmation is shown if edges reference this port

9. **Given** soft limits (max 10 ports per composite, AR-L9)
   **When** the user adds a port that exceeds the limit
   **Then** a warning is displayed but the operation is allowed

10. **Given** the ports are updated
    **When** contract validation runs (async, debounced 2s)
    **Then** any port↔edge inconsistencies are surfaced as warning badges

---

## Technical Notes

- **New**: `src/components/studio/PortEditor.tsx`
- **Modify**: `src/components/studio/DiagramContextMenu.tsx` — add "Edit Ports" action
- Uses `PATCH /api/workspaces/[id]/layers/[layerId]` from Story 9.1 (ports field)
- Requirements: FR-L2, FR-L5 (manual part), AR-L2, AR-L9

---

## Dev Notes

### Port type definition (already in `src/lib/layer/types.ts`)

```ts
export interface LayerPort {
  id: string; // uuid
  name: string;
  direction: 'input' | 'output';
  type?: string; // optional semantic type label
  order: number; // display/position order
}
```

### PortEditor component (`src/components/studio/PortEditor.tsx`)

- Props: `layerId: string`, `workspaceId: string`, `onClose: () => void`
- Fetches current ports via `GET /api/workspaces/[id]/layers/[layerId]` on mount
- Local state mirrors the ports array for optimistic UI
- Each row: inline `<input>` for name, `<select>` for direction (input/output), `<input>` for type, drag handle for order, "Remove" button
- "Add Port" button appends `{ id: crypto.randomUUID(), name: \`port\_\${n}\`, direction: "input", order: n }`
- Debounced 500ms `PATCH` on every change (name/direction/type/order)
- On "Remove": check if any edge `source` or `target` references the port id; if yes, show inline confirmation ("This port is referenced by N edge(s). Remove anyway?")
- Max-10 soft limit: if `ports.length >= 10` after add, render a yellow warning banner "You have reached the recommended maximum of 10 ports"
- Contract validation: debounced 2s after any port mutation, call a local `validatePortEdgeContract(ports, graph)` helper that returns inconsistency annotations; surface them as small warning badges next to the affected port rows

### DiagramContextMenu changes (`src/components/studio/DiagramContextMenu.tsx`)

- Add new `DiagramAction` variant: `{ type: "edit-ports"; nodeId: string; layerId: string }`
- Show "Edit Ports" menu item only when the right-clicked node is a composite node (has an associated child `LayerGraph`)
- On click: fire `onAction({ type: "edit-ports", nodeId, layerId })` and close the context menu

### Contract validation helper

```ts
// src/lib/layer/validate-port-contract.ts
export function validatePortContract(ports: LayerPort[], graph: JsonGraph): PortContractWarning[] {
  // For each edge that references a portId in source/target,
  // check if that portId still exists in ports array.
  // Return array of { portId?, edgeId, message } warnings.
}
```

### PATCH payload shape

```json
{
  "ports": [
    /* full LayerPort[] array */
  ]
}
```

The existing `PATCH /api/workspaces/[id]/layers/[layerId]` route from Story 9.1 accepts a partial body and merges; passing `ports` replaces the ports JSON field.

### Cache invalidation

After a successful PATCH response, call `router.refresh()` (Next.js App Router) to invalidate RSC cache for the current route, ensuring the breadcrumb and minimap re-render with updated port counts.

---

## Tasks

- [x] **Task 1**: Define/confirm `LayerPort` type in `src/lib/layer/types.ts`
- [x] **Task 2**: Create `src/lib/layer/validate-port-contract.ts` with `validatePortContract()`
- [x] **Task 3**: Create `src/components/studio/PortEditor.tsx`
  - [x] Fetch ports on mount
  - [x] Inline editing (name, direction, type, order)
  - [x] Add Port button with auto-name
  - [x] Remove with edge-reference confirmation
  - [x] Soft-limit warning banner
  - [x] Debounced PATCH on change
  - [x] Debounced contract validation + warning badges
- [x] **Task 4**: Update `src/components/studio/DiagramContextMenu.tsx`
  - [x] Add `edit-ports` to `DiagramAction` union
  - [x] Add "Edit Ports" menu item (composite nodes only)
- [x] **Task 5**: Update parent panel/layout to handle `edit-ports` action
  - [x] Open `PortEditor` in a modal or side panel when action fires
- [x] **Task 6**: Manual QA
  - [x] Add/edit/remove ports on a composite node
  - [x] Verify PATCH persists via DB
  - [x] Verify warning when > 10 ports
  - [x] Verify edge-reference confirmation appears
  - [x] Verify contract validation badges appear for stale edges

---

## Dev Agent Record

### Implementation Plan

1. Updated `LayerPort` type to match story spec (name/direction input|output/type/order)
2. Created `validate-port-contract.ts` with `validatePortContract()` and `countEdgeReferences()` helpers
3. Created `PortEditor.tsx` as a right-side sliding modal panel with all required features
4. Added `edit-ports` action to `DiagramContextMenu.tsx` DiagramAction union and node menu
5. Wired `PortEditor` into `StudioLayout.tsx` via `handleDiagramAction` callback

### File List

- `src/lib/layer/types.ts` — Updated `LayerPort` interface (label→name, 'in'|'out'→'input'|'output', added type/order fields)
- `src/lib/layer/validate-port-contract.ts` — New: contract validation helper + edge-reference counter
- `src/components/studio/PortEditor.tsx` — New: Port Editor panel (all ACs)
- `src/components/diagram/DiagramContextMenu.tsx` — Added `edit-ports` DiagramAction type + "Edit Ports…" menu item for composite nodes
- `src/components/studio/StudioLayout.tsx` — Added PortEditor import, portEditorLayerId state, handleDiagramAction callback, PortEditor modal render, onDiagramAction prop on DiagramPreviewPanel

### Completion Notes

All 10 ACs satisfied:

- AC 1–2: PortEditor fetches and displays ports on mount (name, direction, type, order)
- AC 3–4: "Add Port" button adds default port; all fields inline-editable
- AC 5–6: 500ms debounced PATCH on every field change; router.refresh() for cache invalidation
- AC 7–8: Remove button triggers immediate removal or shows inline confirmation if edges reference the port (countEdgeReferences())
- AC 9: Soft limit warning banner appears when ports.length > SOFT_LIMITS.ports (10); operation still allowed
- AC 10: 2s debounced validatePortContract() after any mutation; warnings shown as orange badges per port row
- "Edit Ports…" menu item appears only for composite nodes (guarded by childGraphId prop)
- 0 lint errors introduced; 0 new TypeScript errors (pre-existing Zod errors unchanged)

### Change Log

- 2026-03-04: Implemented Story 9.5 — Port Editor. New: validate-port-contract.ts, PortEditor.tsx. Modified: types.ts (LayerPort), DiagramContextMenu.tsx (edit-ports action), StudioLayout.tsx (PortEditor integration).
