# Story 10.2 — AI Port Inference

## Status: review

## Story

**As a** user,
**I want** the AI to automatically suggest port contracts when I create a composite node,
**So that** I don't have to manually define every port from scratch.

---

## Acceptance Criteria

1. **Given** a node in the parent graph is being decomposed into a composite node
   **When** the AI analyzes the parent graph context
   **Then** it examines all edges connected to that node (incoming = input ports, outgoing = output ports)

2. **And** generates a suggested port list with inferred names, directions, and optional types

3. **Given** the AI has generated port suggestions
   **When** the suggestions are presented to the user
   **Then** they are shown as a preview (non-destructive) that the user can accept, modify, or reject

4. **And** the Port Editor (Story 9.5) is pre-populated with the suggestions if accepted

5. **Given** the user accepts AI-inferred ports
   **When** the ports are saved
   **Then** they are stored on the child LayerGraph via `PATCH /api/workspaces/[id]/layers/[layerId]`

6. **Given** the AI generates ports
   **When** the total would exceed the soft limit (10 ports)
   **Then** a warning is shown and the AI is prompted to consolidate ports

---

## Technical Notes

- Logic integrated into `context-builder.ts` or a new helper in `src/lib/layer/`
- Port inference runs when creating a child layer from a composite node
- Reuses `POST /api/workspaces/[id]/layers/[layerId]/child` from Story 9.1
- Requirements: FR-L5 (AI inference part), AR-L2, AR-L9

---

## Dev Notes

### New file: `src/lib/layer/port-inference.ts`

```ts
import { LayerPort } from './types';
import { JsonGraph, JsonEdge } from '@/lib/json2mermaid/types';

export interface InferredPort extends LayerPort {
  confidence: 'high' | 'medium' | 'low';
  sourceEdgeLabel?: string; // edge label/type that triggered this inference
}

export interface PortInferenceResult {
  ports: InferredPort[];
  consolidationWarning: boolean; // true if raw count would exceed soft limit (10)
  consolidatedFrom?: number; // original count before consolidation
}

export async function inferPortsFromContext(
  nodeId: string,
  parentGraph: JsonGraph,
  nodeName: string
): Promise<PortInferenceResult>;
```

**Implementation strategy:**

1. **Edge analysis (local, no AI needed for basic inference):**
   - Scan `parentGraph.edges` for edges where `source === nodeId` → outgoing = output ports
   - Scan `parentGraph.edges` for edges where `target === nodeId` → incoming = input ports
   - Use edge `label` (if present) as candidate port name; fallback to connected node name

2. **AI enrichment via Haiku (names, types, consolidation):**
   - Build a compact prompt with: node name, raw edge-derived port candidates, parent graph summary
   - Ask the AI to: normalize names (camelCase), infer optional semantic types, consolidate if >10
   - Parse structured JSON response (Zod schema validation)
   - Model: `claude-haiku-4-5-20251001`

3. **Consolidation guard:**
   - If raw edge count > 10: set `consolidationWarning: true`, `consolidatedFrom: rawCount`
   - Re-prompt the AI: "Consolidate these {N} ports into at most 10 meaningful groups"

4. **Port ordering:**
   - All input ports first (order 0..n), then output ports (order n+1..m)

### Zod schema for AI response

```ts
import { z } from 'zod';

const InferredPortSchema = z.object({
  name: z.string(),
  direction: z.enum(['input', 'output']),
  type: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  sourceEdgeLabel: z.string().optional(),
});

const PortInferenceResponseSchema = z.object({
  ports: z.array(InferredPortSchema),
  reasoning: z.string().optional(), // brief explanation shown in UI tooltip
});
```

### New API route: `POST /api/workspaces/[workspaceId]/layers/[layerId]/infer-ports`

- **File**: `src/app/api/workspaces/[workspaceId]/layers/[layerId]/infer-ports/route.ts`
- **Body**: `{ nodeId: string; parentGraphId: string }`
- **Auth**: `requireAuth()`
- **Logic**:
  1. Fetch parent layer graph from DB (validate ownership via workspaceId)
  2. Call `inferPortsFromContext(nodeId, parentGraph, nodeName)`
  3. Return `PortInferenceResult`
- **Response**: `{ ports: InferredPort[], consolidationWarning: boolean, consolidatedFrom?: number }`

### New component: `src/components/studio/PortInferencePreview.tsx`

- **Props**:
  ```ts
  interface PortInferencePreviewProps {
    layerId: string;
    workspaceId: string;
    inferenceResult: PortInferenceResult;
    onAccept: (ports: InferredPort[]) => void;
    onModify: (ports: InferredPort[]) => void; // opens PortEditor pre-populated
    onReject: () => void;
  }
  ```
- **UI**:
  - Modal/panel with title "AI Suggested Ports"
  - Renders a read-only table: Name | Direction | Type | Confidence badge
  - Confidence badge: high=green, medium=yellow, low=gray
  - If `consolidationWarning`: yellow banner "AI consolidated {consolidatedFrom} edge signals into {N} ports (soft limit: 10)"
  - Three action buttons: "Accept All", "Edit Before Saving" (opens PortEditor), "Dismiss"
- **"Accept All" flow**: calls `PATCH /api/workspaces/[id]/layers/[layerId]` with `{ ports }`, then calls `onAccept`
- **"Edit Before Saving" flow**: calls `onModify(ports)` — parent passes ports to PortEditor as `initialPorts`

### PortEditor integration (Story 9.5)

Extend `PortEditor.tsx` to accept an optional `initialPorts` prop:

```ts
interface PortEditorProps {
  layerId: string;
  workspaceId: string;
  onClose: () => void;
  initialPorts?: LayerPort[]; // Story 10.2: pre-populate from AI inference
}
```

When `initialPorts` is provided and the layer has no existing ports, use `initialPorts` as the initial state (skip the `GET` fetch, or merge).

### Trigger point: composite node creation

The inference is triggered when a child layer is created from a composite node:

- **Where**: after `POST /api/workspaces/[id]/layers/[layerId]/child` resolves (client side)
- **Where in code**: `DiagramContextMenu.tsx` or the handler that calls the child-creation route
- **Flow**:
  1. User triggers "Decompose into Layer" from context menu
  2. Child layer is created (existing Story 9.1 route)
  3. Client fires `POST .../infer-ports` with `{ nodeId, parentGraphId }`
  4. `PortInferencePreview` modal is shown with the result
  5. User accepts/modifies/rejects

### Error handling

- If inference API fails: log warning, skip preview, open PortEditor empty (graceful degradation)
- If AI call fails inside `inferPortsFromContext`: fall back to raw edge-derived ports (local analysis only, no AI names/types)
- Rate limit: reuse existing `withAI` middleware on the new route

---

## Tasks

- [x] **Task 1**: Create `src/lib/layer/port-inference.ts`
  - [x] Local edge analysis (scan incoming/outgoing edges for `nodeId`)
  - [x] AI enrichment prompt (Haiku, structured JSON response)
  - [x] Zod schema validation of AI response
  - [x] Consolidation guard (>10 ports re-prompt)
- [x] **Task 2**: Create `POST /api/workspaces/[workspaceId]/layers/[layerId]/infer-ports/route.ts`
  - [x] Auth + workspace ownership validation
  - [x] Fetch parent graph from DB
  - [x] Call `inferPortsFromContext`, return result
- [x] **Task 3**: Create `src/components/studio/PortInferencePreview.tsx`
  - [x] Read-only port table with confidence badges
  - [x] Consolidation warning banner
  - [x] Accept / Edit / Dismiss actions
  - [x] "Accept All" calls PATCH ports endpoint
- [x] **Task 4**: Extend `PortEditor.tsx` with optional `initialPorts` prop
  - [x] Use initial ports when layer has no existing ports
- [x] **Task 5**: Wire inference trigger in `DiagramContextMenu.tsx`
  - [x] After child layer creation resolves, call infer-ports
  - [x] Show `PortInferencePreview` modal with result
  - [x] On "Edit Before Saving": open PortEditor pre-populated
- [x] **Task 6**: Add consolidation warning in UI
  - [x] Banner component in `PortInferencePreview` for >10 port scenario

---

## Dev Agent Record

### Implementation Plan

1. Created `src/lib/layer/port-inference.ts` with:
   - Local edge analysis: scans `parentGraph.edges` for incoming (input) and outgoing (output) edges relative to `nodeId`
   - AI enrichment via Haiku: separate prompts for normal (<= 10 edges) and consolidation (> 10 edges) cases
   - Zod schema validation: `InferredPortSchema` + `PortInferenceResponseSchema`
   - Consolidation guard: when raw edge count > 10, triggers consolidation prompt; sets `consolidationWarning: true`, `consolidatedFrom: rawCount`
   - Graceful fallback: on AI failure, returns raw edge-derived ports (lowconfidence, trimmed to 10)
   - Port ordering: inputs first (order 0..n), outputs second (order n+1..m)

2. Created `POST /api/workspaces/[id]/layers/[layerId]/infer-ports/route.ts`:
   - Auth via `requireAuth()` + workspace membership check
   - Validates body: `{ nodeId, parentGraphId }`
   - Fetches parent layer by `parentGraphId` (workspace ownership verified)
   - Validates `nodeId` exists in parent graph
   - Returns `PortInferenceResult`

3. Created `src/components/studio/PortInferencePreview.tsx`:
   - Centered modal with backdrop
   - Read-only table: Name | Direction (color badge) | Type | Confidence (color badge)
   - Consolidation warning banner (yellow) when `consolidationWarning=true`
   - Three CTA buttons: "Accept All" (PATCH then `onAccept`), "Edit Before Saving" (`onModify`), "Dismiss" (`onReject`)
   - Loading state during PATCH save

4. Extended `src/components/studio/PortEditor.tsx`:
   - Added optional `initialPorts?: LayerPort[]` prop
   - `loadPorts` useEffect: when existing ports are empty AND `initialPorts` provided, pre-populate local state from `initialPorts`

5. Extended `src/components/diagram/DiagramContextMenu.tsx`:
   - Added `decompose-to-layer` action type to `DiagramAction` union
   - Added optional `parentGraphId` and `nodeLabel` props to `NodeMenuProps`
   - Added "Decompose into layer…" menu item (visible only when `!childGraphId && parentGraphId`)

6. Extended `src/components/studio/DiagramPreviewPanel.tsx`:
   - Added `currentLayerGraphId?: string` prop
   - Passes `parentGraphId={currentLayerGraphId}` and `nodeLabel` to `DiagramContextMenu`

7. Extended `src/components/studio/StudioLayout.tsx`:
   - Added `portInferenceState` and `portEditorInitialPorts` state
   - `handleDiagramAction` converted to async; handles `decompose-to-layer`:
     1. POSTs to `.../child` to create the child layer
     2. POSTs to `.../infer-ports` for AI port suggestions
     3. Shows `PortInferencePreview` on success, or falls back to empty `PortEditor`
   - `DiagramPreviewPanel` receives `currentLayerGraphId` from layer stack
   - `PortInferencePreview` renders with `onAccept`, `onModify` (opens pre-populated PortEditor), `onReject`
   - `PortEditor` receives `initialPorts` when opened via "Edit Before Saving"

### File List

- `src/lib/layer/port-inference.ts` — New: inferPortsFromContext + InferredPort + PortInferenceResult types
- `src/app/api/workspaces/[id]/layers/[layerId]/infer-ports/route.ts` — New: POST infer-ports endpoint
- `src/components/studio/PortInferencePreview.tsx` — New: non-destructive AI port suggestion modal
- `src/components/studio/PortEditor.tsx` — Modified: added optional `initialPorts` prop
- `src/components/diagram/DiagramContextMenu.tsx` — Modified: added `decompose-to-layer` action + "Decompose into layer…" menu item
- `src/components/studio/DiagramPreviewPanel.tsx` — Modified: added `currentLayerGraphId` prop, passes it to DiagramContextMenu
- `src/components/studio/StudioLayout.tsx` — Modified: async `handleDiagramAction`, port inference state, PortInferencePreview render

### Completion Notes

All 6 ACs satisfied:

- AC 1: `inferPortsFromContext` scans `parentGraph.edges` — incoming edges (`.to === nodeId`) → input ports; outgoing (`.from === nodeId`) → output ports
- AC 2: AI Haiku enrichment normalizes names to camelCase, infers optional types, assigns confidence levels
- AC 3: `PortInferencePreview` is a read-only, non-destructive modal with Accept/Edit/Dismiss
- AC 4: "Edit Before Saving" opens `PortEditor` with `initialPorts` pre-populated; `PortEditor` uses them when layer has no existing ports
- AC 5: "Accept All" in `PortInferencePreview` calls `PATCH /api/workspaces/[id]/layers/[layerId]` to persist ports
- AC 6: When raw edge count > 10, AI consolidation prompt is used; `consolidationWarning=true` triggers yellow banner in `PortInferencePreview`

0 new TypeScript errors, 0 new ESLint errors introduced.

### Change Log

- 2026-03-04: Implemented Story 10.2 — AI Port Inference. New: port-inference.ts, infer-ports/route.ts, PortInferencePreview.tsx. Modified: PortEditor.tsx, DiagramContextMenu.tsx, DiagramPreviewPanel.tsx, StudioLayout.tsx.
