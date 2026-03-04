# Story 11.2 — Atomic Apply with Checkpoint Restore

## Status: review

## Story

**As a** user,
**I want** the validated restructure proposal to be applied atomically with a pre-restructure checkpoint,
**So that** I can safely roll back if the result doesn't match my expectations.

---

## Acceptance Criteria

1. **Given** the user has validated a restructure proposal
   **When** the apply step begins
   **Then** a checkpoint tagged `"pre-restructure"` is automatically created via the existing checkpoint system

2. **And** the checkpoint captures the entire current state (all LayerGraphs for the workspace, serialized as JSON in `graphState`)

3. **Given** a checkpoint is created
   **When** the atomic apply runs
   **Then** for each cluster in the validated proposal:
   1. A new child `LayerGraph` is created with the clustered nodes as its graph
   2. The clustered nodes are replaced by a single composite node in the parent graph
   3. Ports are set on the child `LayerGraph` based on cross-cluster edges (reusing `SuggestedPort[]` from the cluster)
   4. Cross-cluster edges are rewired to the composite node in the parent graph

4. **And** all operations succeed or all are rolled back (Prisma `$transaction`)

5. **Given** the restructure is applied
   **When** the user views the result
   **Then** the parent graph shows composite nodes where clusters were
   **And** double-clicking a composite navigates to the child layer (Story 9.3 navigation)
   **And** port contracts are consistent (validated by Story 10.3 `validateContracts`)

6. **Given** the user is unhappy with the result
   **When** they access the checkpoint timeline (`CheckpointTimeline.tsx`)
   **Then** the `"pre-restructure"` checkpoint is visible
   **And** restoring it reverts all LayerGraphs to their pre-restructure state

7. **Given** the restructure involves multiple layers
   **When** the apply step processes the proposal
   **Then** all layers are updated in a single database transaction
   **And** if any step fails, the entire restructure is rolled back

8. **Given** the restructure completes successfully
   **When** the status reaches `'done'`
   **Then** contract validation (Story 10.3) runs on all affected layers
   **And** the UI updates to reflect the new hierarchical structure

---

## Technical Notes

- Extends `restructure-layers.graph.ts` from Story 11.1 — the `apply` FnNode currently does an in-memory graph mutation; this story replaces it with a DB-backed atomic apply
- Checkpoint system: `src/lib/studio/checkpoint-persistence.ts` (`checkpointPersistence.createCheckpoint`) — the pre-restructure snapshot stores serialized `LayerGraph[]` in `graphState`; `userMessage` is set to `"pre-restructure"`
- The `apply` FnNode must:
  1. Fetch all LayerGraphs for the workspace (`prisma.layerGraph.findMany`)
  2. Create checkpoint via `checkpointPersistence.createCheckpoint` (outside the transaction — checkpoint creation is idempotent and must succeed before mutating)
  3. Run the full cluster-to-layer transformation in `prisma.$transaction()`
- Atomic transformation within `$transaction`:
  - For each cluster: `prisma.layerGraph.create` (child layer, ports from `suggestedPorts`, graph = cluster's nodes + internal edges)
  - Update parent `LayerGraph.graph`: remove clustered nodes, add composite node, rewire cross-cluster edges
  - Use `prisma.layerGraph.updateMany` or individual `update` calls — all within the same transaction array
- Composite node shape in parent graph: `{ id: cluster.id, label: cluster.name, type: 'composite' }`
- Restore: the existing `POST /api/workspaces/[id]/studios/[studioId]/checkpoints/[checkpointId]/restore/route.ts` needs a variant or the restore endpoint must also restore `LayerGraph` rows from the snapshot; restore logic is in a new `restoreLayerGraphsFromSnapshot` helper in `src/lib/layer/layer-snapshot.ts`
- Contract validation: after transaction commits, call `validateContracts` from `src/lib/layer/contract-validator.ts` on each newly created child layer against the updated parent graph; emit warnings via SSE `restructure-progress` event
- Requirements: FR-L8, NFR-L5, AR-L7

---

## Implementation Tasks

### 1. `src/lib/layer/layer-snapshot.ts` — NEW [x]

- `snapshotLayers(workspaceId: string, tx?: PrismaClient): Promise<LayerGraphRecord[]>` — reads all non-deleted `LayerGraph` rows for the workspace; serializable as JSON
- `restoreLayerGraphsFromSnapshot(workspaceId: string, snapshot: LayerGraphRecord[]): Promise<void>` — inside a `$transaction`: soft-delete current layers then recreate from snapshot (preserve original `id` via `upsert` with `create` + forced `id`)

### 2. Extend `RestructureState` in `src/lib/graphs/restructure-layers.types.ts` [x]

- Add `checkpointId?: string` — ID of the created pre-restructure checkpoint
- Add `appliedLayerIds?: string[]` — IDs of newly created child LayerGraphs

### 3. Update `apply` FnNode in `src/lib/graphs/restructure-layers.graph.ts` [x]

- Replace in-memory graph mutation with DB-backed atomic apply:
  1. Snapshot current layers via `snapshotLayers(workspaceId)`
  2. Call `checkpointPersistence.createCheckpoint(studioId, { userMessage: 'pre-restructure', graphState: snapshot, ... })`; store result in `state.checkpointId`
  3. Run `prisma.$transaction(async (tx) => { ... })`:
     - For each cluster in `state.finalClusters`:
       a. Build child graph: nodes = clustered nodes from parent graph; edges = edges whose both endpoints are in the cluster
       b. Build ports from `cluster.suggestedPorts`: map `SuggestedPort` → `LayerPort` (assign `id`, `order`)
       c. `tx.layerGraph.create({ data: { workspaceId, name: cluster.name, parentGraphId: parentLayerId, parentNodeId: cluster.id, depth: parentDepth + 1, ports, graph: childGraph } })`
       d. Mutate parent graph: remove clustered node IDs, add `{ id: cluster.id, label: cluster.name, type: 'composite' }`, rewire cross-cluster edges to composite
     - `tx.layerGraph.update({ where: { id: parentLayerId }, data: { graph: updatedParentGraph } })`
  4. After transaction: run `validateContracts` on each new child layer; collect warnings
  5. Emit SSE `restructure-progress` events for each phase (checkpoint-created, transaction-start, cluster-N-applied, validation-done)
  6. Set `state.appliedLayerIds`, `state.updatedGraph`

### 4. `POST /api/workspaces/[id]/layers/restore-snapshot/route.ts` — NEW [x]

- Body: `{ checkpointId: string }`
- Loads checkpoint via `checkpointPersistence.getCheckpoint(checkpointId)`
- Validates `graphState` is a `LayerGraphRecord[]` snapshot
- Calls `restoreLayerGraphsFromSnapshot(workspaceId, snapshot)`
- Returns `{ restored: number }` count

### 5. `CheckpointTimeline.tsx` — update restore handler [x]

- When restoring a checkpoint with `userMessage === 'pre-restructure'`, call the new `POST /api/workspaces/[id]/layers/restore-snapshot` in addition to the existing studio restore
- Show a `"pre-restructure"` badge/label on these checkpoint nodes in the timeline

### 6. `StudioLayout.tsx` — update SSE handler [x]

- Handle new `restructure-progress` sub-events: `checkpoint-created`, `transaction-start`, `cluster-applied`, `validation-done`
- Display inline progress messages in the chat (e.g., "Checkpoint saved", "Applying cluster 1/3…", "Validation: 2 warnings")

---

## Dev Notes

- `studioId` must be threaded into `RestructureState` (add `studioId?: string` to the state type, populated at graph invocation from the request body) so the `apply` FnNode can call `checkpointPersistence.createCheckpoint`
- The snapshot stores `LayerPort[]` as `ports` JSON — use the existing `as unknown as T` Prisma 7 cast pattern when reading back
- `restoreLayerGraphsFromSnapshot` must use `prisma.layerGraph.upsert` with `where: { id }` and force-set `id` in `create` via `{ id: record.id, ... }` — verify Prisma schema allows this (cuid fields accept explicit values on create)
- If the workspace has no LayerGraphs yet (first restructure), the snapshot is an empty array; checkpoint is still created (for consistency)
- Cycle detection: newly created child layers don't risk cycles because they are brand-new rows; no need to call `wouldCreateCycle`
- Contract validation after apply: iterate `appliedLayerIds`, load each child layer + its parent graph, call `validateContracts`; merge into `ValidationWarning[]` array emitted as SSE

---

## Dev Agent Record

### Files Changed

- `src/lib/layer/layer-snapshot.ts` — NEW: `snapshotLayers` and `restoreLayerGraphsFromSnapshot` helpers; snapshot serializes all non-deleted LayerGraphs; restore uses `$transaction` with soft-delete + upsert (force-set `id`)
- `src/lib/graphs/restructure-layers.types.ts` — Added `studioId?: string`, `checkpointId?: string`, `appliedLayerIds?: string[]` to `RestructureState`
- `src/lib/graphs/restructure-layers.graph.ts` — Replaced in-memory `apply` FnNode with DB-backed async FnNode: snapshots layers, creates pre-restructure checkpoint via `checkpointPersistence`, runs `prisma.$transaction` to create child LayerGraphs + update parent graph, runs `validateContracts` post-commit; added imports for `prisma`, `checkpointPersistence`, `snapshotLayers`, `validateContracts`, `LayerPort`
- `src/app/api/ai/restructure/route.ts` — Added optional `studioId` to request schema and initial state; updated done response to include `checkpointId` and `appliedLayerIds`; updated `emitSSEForOutcome` done message to mention applied layer count
- `src/app/api/workspaces/[id]/layers/restore-snapshot/route.ts` — NEW: `POST` route; validates workspace membership + checkpoint ownership; calls `restoreLayerGraphsFromSnapshot`; returns `{ restored: number }`
- `src/components/studio/CheckpointTimeline.tsx` — Added amber dot badge on checkpoint nodes with `userMessage === 'pre-restructure'`
- `src/components/studio/StudioLayout.tsx` — `handleCheckpointRestore`: detects pre-restructure checkpoints via `cpTree.tree` lookup; calls `POST /api/workspaces/[id]/layers/restore-snapshot` before studio restore; shows tailored toast message; updated `restructure-progress` SSE emoji map with new sub-step types
- `src/lib/sse/sse.types.ts` — Extended `RestructureStep` with `'checkpoint-created'`, `'transaction-start'`, `'cluster-applied'`, `'validation-done'`

### Notes

- The `apply` FnNode is now `async` — claudegraph `FnNode.fn` supports async/Promise return values.
- Pre-restructure checkpoint `graphState` stores `LayerGraphRecord[]` (not `StudioSessionState`) — the restore-snapshot route validates `Array.isArray(snapshot)` before proceeding.
- `restoreLayerGraphsFromSnapshot` uses `upsert` with explicit `id` on create; Prisma cuid fields accept explicit string values, so existing IDs are preserved on restore.
- Empty snapshot (no layers yet) is valid — `restoreLayerGraphsFromSnapshot` simply soft-deletes any current layers and creates nothing.
- If `studioId` is not provided (standalone API call without a studio context), checkpoint creation is skipped; the atomic transaction still runs.
- All 641 pre-existing tests pass; no new TypeScript errors introduced (6 pre-existing Zod v4 errors in unrelated files remain unchanged).
- The `CheckpointTimeline` badge is purely visual (amber dot); the restore logic is in `StudioLayout.handleCheckpointRestore`, which reads `cpTree.tree` to detect pre-restructure checkpoints and calls the new API endpoint before the standard studio restore.
