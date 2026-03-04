# Story 9.1 — LayerGraph Data Model and CRUD API

## Status: review

## Story

**As a** developer,
**I want** a LayerGraph Prisma model with self-referencing tree structure and CRUD API routes,
**So that** composite layers can be persisted, queried, and managed as a hierarchical tree.

---

## Acceptance Criteria

1. **Given** the Prisma schema has no LayerGraph model
   **When** the migration runs
   **Then** a `LayerGraph` table is created with fields: `id`, `workspaceId`, `name`, `description`, `parentNodeId`, `parentGraphId`, `depth`, `ports` (JSON, default `[]`), `graph` (JSON, default `{}`), `summary`, `deletedAt`, `createdAt`, `updatedAt`
   **And** a self-relation `LayerTree` links `parentGraphId` to `id`

2. **Given** a workspace exists
   **When** `POST /api/workspaces/[id]/layers` is called with `{ name }` body
   **Then** a root LayerGraph (depth 0, no parent) is created and returned

3. **Given** a LayerGraph exists
   **When** `POST /api/workspaces/[id]/layers/[layerId]/child` is called with `{ name, parentNodeId }`
   **Then** a child LayerGraph is created with `depth = parent.depth + 1`, `parentGraphId` set, and `parentNodeId` referencing the composite node in the parent's graph

4. **Given** a LayerGraph exists
   **When** `GET /api/workspaces/[id]/layers/[layerId]` is called
   **Then** the layer graph is returned with its ports and graph data

5. **Given** a LayerGraph exists
   **When** `PATCH /api/workspaces/[id]/layers/[layerId]` is called with updated fields
   **Then** the layer is updated and `summary` is set to null (cache invalidation)

6. **Given** a LayerGraph exists
   **When** `DELETE /api/workspaces/[id]/layers/[layerId]` is called
   **Then** the layer is soft-deleted (`deletedAt` set to now) instead of hard-deleted (NFR-L4)

7. **Given** a child LayerGraph creation request
   **When** the candidate child would create a cycle (appears in ancestor chain)
   **Then** the API returns a 400 error with a cycle detection message (NFR-L3)
   **And** the ancestor chain walk is limited to 6 iterations (depth cap)

8. **Given** a workspace exists
   **When** `GET /api/workspaces/[id]/layers` is called
   **Then** all non-deleted root layers are returned with their tree structure

9. **Given** soft limits defined (depth ≤ 6, ports ≤ 10, nodes ≤ 50, composites ≤ 15)
   **When** a creation or update exceeds a soft limit
   **Then** a warning is returned in the response (non-blocking) but the operation succeeds (AR-L9)

---

## Technical Notes

### Requirements Referenced

FR-L1, FR-L2, NFR-L3, NFR-L4, AR-L1, AR-L2, AR-L9, AR-L10, AR-L11, AR-L12

### New Files

```
src/lib/layer/types.ts
src/lib/layer/layer-service.ts
src/lib/layer/cycle-detector.ts
src/app/api/workspaces/[id]/layers/route.ts
src/app/api/workspaces/[id]/layers/[layerId]/route.ts
src/app/api/workspaces/[id]/layers/[layerId]/child/route.ts
```

### Prisma Schema Addition

```prisma
model LayerGraph {
  id           String      @id @default(cuid())
  workspaceId  String
  name         String
  description  String?
  parentNodeId String?
  parentGraphId String?
  depth        Int         @default(0)
  ports        Json        @default("[]")
  graph        Json        @default("{}")
  summary      String?
  deletedAt    DateTime?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  workspace    Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  parent       LayerGraph? @relation("LayerTree", fields: [parentGraphId], references: [id])
  children     LayerGraph[] @relation("LayerTree")

  @@index([workspaceId])
  @@index([parentGraphId])
}
```

### Migration Note

Clean migration: drop old data if any LayerGraph table previously existed (AR-L11). Use `prisma migrate dev` with a descriptive name (e.g. `add_layer_graph`).

### `src/lib/layer/types.ts`

```typescript
export interface LayerPort {
  id: string;
  label: string;
  direction: 'in' | 'out';
}

export interface LayerGraphRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  parentNodeId: string | null;
  parentGraphId: string | null;
  depth: number;
  ports: LayerPort[];
  graph: object;
  summary: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftLimitWarnings {
  depthExceeded?: boolean;
  portsExceeded?: boolean;
  nodesExceeded?: boolean;
  compositesExceeded?: boolean;
}

export const SOFT_LIMITS = {
  depth: 6,
  ports: 10,
  nodes: 50,
  composites: 15,
} as const;
```

### `src/lib/layer/cycle-detector.ts`

Walk the ancestor chain via `parentGraphId` using Prisma, up to 6 hops. If the candidate `childId` appears in the chain, return `true` (cycle detected).

```typescript
// Max iterations = SOFT_LIMITS.depth (6)
export async function wouldCreateCycle(
  prisma: PrismaClient,
  parentId: string,
  candidateId: string
): Promise<boolean>;
```

### `src/lib/layer/layer-service.ts`

Facade exposing:

- `createRoot(workspaceId, name, description?)` → `LayerGraphRecord`
- `createChild(workspaceId, parentId, name, parentNodeId, description?, candidateId?)` → `{ layer: LayerGraphRecord; warnings: SoftLimitWarnings }`
- `getLayer(workspaceId, layerId)` → `LayerGraphRecord | null`
- `listRootLayers(workspaceId)` → `LayerGraphRecord[]` with nested `children` (non-deleted only)
- `updateLayer(workspaceId, layerId, patch)` → `{ layer: LayerGraphRecord; warnings: SoftLimitWarnings }` — always nulls `summary`
- `softDeleteLayer(workspaceId, layerId)` → `void`

Soft limit checks are performed inside `createChild` and `updateLayer`; warnings are collected and returned but do not block the operation.

### API Routes

#### `GET /api/workspaces/[id]/layers`

Returns all non-deleted root layers (`parentGraphId === null`) for the workspace, including their `children` tree.

Response `200`:

```json
{ "layers": [ ...LayerGraphRecord[] ] }
```

#### `POST /api/workspaces/[id]/layers`

Body: `{ name: string; description?: string }`

Creates a root layer (depth 0).

Response `201`:

```json
{ "layer": LayerGraphRecord }
```

#### `GET /api/workspaces/[id]/layers/[layerId]`

Returns the single layer graph (ports + graph included).

Response `200`:

```json
{ "layer": LayerGraphRecord }
```

Response `404` if not found or soft-deleted.

#### `PATCH /api/workspaces/[id]/layers/[layerId]`

Body (all optional): `{ name?, description?, ports?, graph? }`

Updates allowed fields and nulls `summary`.

Response `200`:

```json
{ "layer": LayerGraphRecord, "warnings": SoftLimitWarnings }
```

#### `DELETE /api/workspaces/[id]/layers/[layerId]`

Soft-deletes the layer (sets `deletedAt = now()`).

Response `200`:

```json
{ "ok": true }
```

#### `POST /api/workspaces/[id]/layers/[layerId]/child`

Body: `{ name: string; parentNodeId: string; description?: string; candidateId?: string }`

1. Load parent layer; 404 if not found.
2. Run cycle detection (if `candidateId` provided); 400 if cycle would be created.
3. Create child with `depth = parent.depth + 1`.
4. Return child with soft-limit warnings.

Response `201`:

```json
{ "layer": LayerGraphRecord, "warnings": SoftLimitWarnings }
```

Response `400` on cycle:

```json
{ "error": "Cycle detected: candidate layer already appears in the ancestor chain." }
```

### Auth & Workspace Guard

All routes use `requireAuth()` from `src/lib/auth-utils.ts`. Verify workspace ownership before any DB operation (same pattern as Story 8.1 canvas routes).

### Error Handling

- `400` — invalid body, cycle detected, validation failure
- `401` — unauthenticated
- `403` — workspace not owned by caller
- `404` — layer or workspace not found
- `500` — unexpected server error

---

## Implementation Checklist

- [x] Add `LayerGraph` model to `prisma/schema.prisma`
- [x] Run `npx prisma migrate dev --name add_layer_graph`
- [x] Generate Prisma client (`npx prisma generate`)
- [x] Create `src/lib/layer/types.ts`
- [x] Create `src/lib/layer/cycle-detector.ts`
- [x] Create `src/lib/layer/layer-service.ts`
- [x] Create `src/app/api/workspaces/[id]/layers/route.ts` (GET + POST)
- [x] Create `src/app/api/workspaces/[id]/layers/[layerId]/route.ts` (GET + PATCH + DELETE)
- [x] Create `src/app/api/workspaces/[id]/layers/[layerId]/child/route.ts` (POST)
- [x] Manual smoke test: create root, create child, detect cycle, soft-delete, list

---

## Dev Agent Record

### Files Changed

- `prisma/schema.prisma` — Added `LayerGraph` model with `LayerTree` self-relation; added `layerGraphs` relation to `Workspace`
- `prisma/migrations/20260304000000_add_layer_graph/migration.sql` — New migration: CREATE TABLE LayerGraph with indexes and FKs
- `src/lib/layer/types.ts` — New: `LayerPort`, `LayerGraphRecord`, `SoftLimitWarnings`, `SOFT_LIMITS`
- `src/lib/layer/cycle-detector.ts` — New: `wouldCreateCycle()` walks ancestor chain up to 6 hops
- `src/lib/layer/layer-service.ts` — New: `createRoot`, `createChild`, `getLayer`, `listRootLayers`, `updateLayer`, `softDeleteLayer`
- `src/app/api/workspaces/[id]/layers/route.ts` — New: GET (list roots) + POST (create root)
- `src/app/api/workspaces/[id]/layers/[layerId]/route.ts` — New: GET + PATCH (summary nulled) + DELETE (soft-delete)
- `src/app/api/workspaces/[id]/layers/[layerId]/child/route.ts` — New: POST (create child with cycle detection)

### Implementation Notes

- Prisma 7 generated client at `@/generated/prisma/client` (not `@/generated/prisma`)
- `ports` JSON field requires `as unknown as LayerPort[]` double cast due to Prisma `JsonValue` union type
- `z.record()` in Zod v4 requires two arguments: `z.record(z.string(), z.unknown())`
- Soft limits are non-blocking — warnings returned in response body, operation always proceeds (AR-L9)
- Cycle detection limited to 6 ancestor hops matching `SOFT_LIMITS.depth` (NFR-L3)
- `candidateId` optional param on `createChild` enables cycle guard for reparenting scenarios
- `listRootLayers` uses nested `include` for up to 3 levels of tree depth
- `updateLayer` always sets `summary: null` regardless of other patch fields (cache invalidation)
- All routes follow canvas routes pattern: `requireAuth()` → workspace membership check → service call

### Completion Notes

All 9 ACs satisfied:

- AC1: LayerGraph table + LayerTree self-relation in schema + migration SQL ✅
- AC2: POST /layers creates root (depth 0) ✅
- AC3: POST /layers/[layerId]/child creates child with depth = parent.depth + 1 ✅
- AC4: GET /layers/[layerId] returns layer with ports and graph ✅
- AC5: PATCH /layers/[layerId] updates fields and nulls summary ✅
- AC6: DELETE /layers/[layerId] soft-deletes (sets deletedAt) ✅
- AC7: Cycle detection returns 400, ancestor walk capped at 6 iterations ✅
- AC8: GET /layers returns non-deleted root layers with children tree ✅
- AC9: Soft limit warnings returned non-blocking in createChild and updateLayer responses ✅

### Change Log

- 2026-03-04: Story 9.1 implemented — LayerGraph Prisma model, migration, layer service module, 5 REST API routes
