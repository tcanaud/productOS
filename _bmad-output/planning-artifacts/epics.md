---
stepsCompleted: [1, 2, 3]
inputDocuments: [architecture.md, product-vision.md]
---

# ProductOS - Epic Breakdown (Hierarchical Composable Layers)

## Overview

This document provides the complete epic and story breakdown for the Hierarchical Composable Layers feature of ProductOS, decomposing the requirements from the Architecture Decision Document into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR-L1: Composite nodes — a graph node that encapsulates a child graph (separate artifact)
- FR-L2: Port contracts — typed I/O ports on composite nodes defining the interface between layers
- FR-L3: Layer navigation — zoom into/out of composite nodes with breadcrumb and minimap
- FR-L4: AI-aware layer context — claudegraph receives parent contracts + current graph + child contracts
- FR-L5: Port management — AI-inferred ports from parent edges + manual user editing
- FR-L6: AI structural refactoring — analyze flat graph → propose layer decomposition → negotiate → apply atomically
- FR-L7: Contract validation — verify port consistency between parent and child graphs
- FR-L8: Snapshot/restore — mandatory pre-refactoring checkpoint for safe rollback

### Non-Functional Requirements

- NFR-L1: Layer navigation transition < 400ms (animated zoom feel)
- NFR-L2: AI context window for layers capped at 2 ancestor levels (contracts only) to control prompt size
- NFR-L3: Cycle detection on composite node creation (prevent circular layer references)
- NFR-L4: Soft-delete on composite node removal (preserve child graph artifacts)
- NFR-L5: Refactoring preview must be non-destructive until user confirms

### Additional Requirements

- AR-L1: LayerGraph Prisma model with self-referencing tree structure (D1)
- AR-L2: Ports stored as JSON on LayerGraph, validation application-side (D2)
- AR-L3: Hybrid navigation — client Zustand + URL param + context sent per request (D3)
- AR-L4: Composite rendering via Mermaid classDef + SVG post-processing badges (D4)
- AR-L5: Progressive AI context summarization with cache (D5)
- AR-L6: Dedicated claudegraph restructure-layers.graph (D6)
- AR-L7: Checkpoint system reuse for snapshot/restore (D7)
- AR-L8: Async contract validation with non-blocking warnings — live-review pattern (D8)
- AR-L9: Soft limits — depth: 6, ports: 10, nodes: 50, composites: 15 (D9)
- AR-L10: Cycle detection via ancestor chain walking, max 6 iterations (D10)
- AR-L11: Clean migration — table rase, no old data migration
- AR-L12: New module src/lib/layer/ with 6 files (types, service, context-builder, cycle-detector, contract-validator, summary-generator)

### FR Coverage Map

| Requirement | Epic        | Description                                      |
| ----------- | ----------- | ------------------------------------------------ |
| FR-L1       | Epic 9      | Composite nodes in graph                         |
| FR-L2       | Epic 9      | Port contracts I/O                               |
| FR-L3       | Epic 9      | Layer navigation (zoom, breadcrumb, minimap)     |
| FR-L4       | Epic 10     | AI-aware layer context                           |
| FR-L5       | Epic 9 + 10 | Manual port editing (9) + AI port inference (10) |
| FR-L6       | Epic 11     | AI structural refactoring                        |
| FR-L7       | Epic 10     | Contract validation                              |
| FR-L8       | Epic 11     | Snapshot/restore                                 |
| NFR-L1      | Epic 9      | Transition < 400ms                               |
| NFR-L2      | Epic 10     | Context cap 2 levels                             |
| NFR-L3      | Epic 9      | Cycle detection                                  |
| NFR-L4      | Epic 9      | Soft-delete                                      |
| NFR-L5      | Epic 11     | Non-destructive preview                          |

## Epic List

9. **Epic 9: Hierarchical Graph Foundation** — LayerGraph data model, composite nodes, port contracts, layer navigation with breadcrumb and minimap, cycle detection, soft limits
10. **Epic 10: AI-Aware Layers** — AI layer context builder, progressive summarization with cache, AI port inference, async contract validation with warnings
11. **Epic 11: AI Structural Refactoring** — Dedicated restructure claudegraph, clustering proposal/negotiation, checkpoint-based snapshot/restore, bottom-up/top-down/hybrid modes

## Epic 9: Hierarchical Graph Foundation

**Goal:** Establish the data model, rendering, navigation, and manual editing foundation for hierarchical composable layers — enabling users to create composite nodes, navigate between layers, and manage port contracts.

### Story 9.1: LayerGraph Data Model and CRUD API

As a developer,
I want a LayerGraph Prisma model with self-referencing tree structure and CRUD API routes,
So that composite layers can be persisted, queried, and managed as a hierarchical tree.

**Acceptance Criteria:**

**Given** the Prisma schema has no LayerGraph model
**When** the migration runs
**Then** a `LayerGraph` table is created with fields: `id`, `workspaceId`, `name`, `description`, `parentNodeId`, `parentGraphId`, `depth`, `ports` (JSON, default `[]`), `graph` (JSON, default `{}`), `summary`, `deletedAt`, `createdAt`, `updatedAt`
**And** a self-relation `LayerTree` links `parentGraphId` to `id`

**Given** a workspace exists
**When** `POST /api/workspaces/[id]/layers` is called with `{ name }` body
**Then** a root LayerGraph (depth 0, no parent) is created and returned

**Given** a LayerGraph exists
**When** `POST /api/workspaces/[id]/layers/[layerId]/child` is called with `{ name, parentNodeId }`
**Then** a child LayerGraph is created with `depth = parent.depth + 1`, `parentGraphId` set, and `parentNodeId` referencing the composite node in the parent's graph

**Given** a LayerGraph exists
**When** `GET /api/workspaces/[id]/layers/[layerId]` is called
**Then** the layer graph is returned with its ports and graph data

**Given** a LayerGraph exists
**When** `PATCH /api/workspaces/[id]/layers/[layerId]` is called with updated fields
**Then** the layer is updated and `summary` is set to null (cache invalidation)

**Given** a LayerGraph exists
**When** `DELETE /api/workspaces/[id]/layers/[layerId]` is called
**Then** the layer is soft-deleted (`deletedAt` set to now) instead of hard-deleted (NFR-L4)

**Given** a child LayerGraph creation request
**When** the candidate child would create a cycle (appears in ancestor chain)
**Then** the API returns a 400 error with a cycle detection message (NFR-L3)
**And** the ancestor chain walk is limited to 6 iterations (depth cap)

**Given** a workspace exists
**When** `GET /api/workspaces/[id]/layers` is called
**Then** all non-deleted root layers are returned with their tree structure

**Given** soft limits defined (depth ≤ 6, ports ≤ 10, nodes ≤ 50, composites ≤ 15)
**When** a creation or update exceeds a soft limit
**Then** a warning is returned in the response (non-blocking) but the operation succeeds (AR-L9)

**Technical Notes:**

- New module: `src/lib/layer/types.ts`, `layer-service.ts`, `cycle-detector.ts`
- API routes: `src/app/api/workspaces/[id]/layers/` (route.ts, [layerId]/route.ts, [layerId]/child/route.ts)
- Clean migration: drop old data (AR-L11)
- Requirements: FR-L1, FR-L2, NFR-L3, NFR-L4, AR-L1, AR-L2, AR-L9, AR-L10, AR-L11, AR-L12

### Story 9.2: Composite Node Rendering

As a user,
I want composite nodes to be visually distinct in the diagram with a layer indicator badge,
So that I can immediately identify which nodes contain child layers.

**Acceptance Criteria:**

**Given** a JsonGraph contains a node with `type: "composite"` and `childGraphId`
**When** `json2mermaid` converts the graph to Mermaid syntax
**Then** the node receives a `:::composite` class
**And** a `classDef composite fill:#f0f4ff,stroke:#4f46e5,stroke-width:3px,stroke-dasharray:5 5` is emitted

**Given** a Mermaid diagram contains composite-classed nodes
**When** the SVG is rendered and post-processed by badge-renderer
**Then** a layer indicator icon/badge is injected on composite nodes (similar to existing review badges)

**Given** a composite node in the diagram
**When** the user hovers over it
**Then** the composite styling is enhanced (cursor pointer, glow effect) indicating it's interactive

**Given** the existing `GraphNode` interface
**When** a composite node is represented
**Then** it has `type: "composite"` and `childGraphId: string` fields added to the interface

**Technical Notes:**

- Modify: `src/lib/json2mermaid/index.ts` (add classDef + :::composite)
- Modify: `src/lib/svg/badge-renderer.ts` (add layer indicator badge)
- Modify: `src/components/diagram/MermaidPreview.tsx` (composite hover CSS)
- Update GraphNode type in json2mermaid types
- Requirements: FR-L1, AR-L4

### Story 9.3: Layer Navigation with Breadcrumb

As a user,
I want to double-click a composite node to zoom into its child layer and navigate back via a breadcrumb,
So that I can explore the hierarchical structure of my graph intuitively.

**Acceptance Criteria:**

**Given** a composite node is displayed in the diagram
**When** the user double-clicks on it
**Then** the view transitions to the child LayerGraph (animated transition < 400ms, NFR-L1)
**And** the URL updates to include `?layer={childGraphId}`
**And** the Zustand layer navigation store is updated (`pushLayer`)

**Given** the user is navigated into a child layer
**When** the LayerBreadcrumb component renders
**Then** it displays the full path from root to current layer (e.g., "Root > Marketing > Campaign Flow")
**And** each segment is clickable to jump to that layer

**Given** the user clicks on a breadcrumb segment
**When** the click is registered
**Then** the view navigates to the selected layer (`jumpToLayer`)
**And** the layerStack is trimmed to match the new position
**And** the URL updates accordingly

**Given** the user is in a child layer
**When** they click the back/pop action
**Then** the view transitions back to the parent layer (`popLayer`)
**And** the URL updates to the parent layer ID

**Given** the page is loaded with `?layer=xyz` in the URL
**When** the page initializes
**Then** the Zustand store reconstructs the layerStack from the DB (walking parentGraphId chain)
**And** the correct layer is displayed

**Given** the "Zoom into layer" action is added to DiagramContextMenu
**When** the user right-clicks a composite node and selects "Zoom into layer"
**Then** it behaves identically to double-click navigation

**Technical Notes:**

- New: `src/hooks/useLayerNavigation.ts` (Zustand store)
- New: `src/components/studio/LayerBreadcrumb.tsx`
- Modify: `src/components/studio/StudioLayout.tsx` (integrate breadcrumb, layer routing)
- Modify: `src/components/studio/DiagramPreviewPanel.tsx` (double-click composite → navigate)
- Modify: `src/components/studio/DiagramContextMenu.tsx` (add "Zoom into layer" action)
- Requirements: FR-L3, NFR-L1, AR-L3

### Story 9.4: Layer Minimap

As a user,
I want a minimap showing the full tree structure of my layers with my current position highlighted,
So that I can understand the overall hierarchy and quickly jump to any layer.

**Acceptance Criteria:**

**Given** a workspace has LayerGraphs forming a tree
**When** the LayerMinimap component renders
**Then** it displays the tree structure with node names
**And** the current layer is visually highlighted (e.g., bold, different color)
**And** composite nodes with children are shown with expand/collapse indicators

**Given** the minimap is displayed
**When** the user clicks on any layer node in the minimap
**Then** the view navigates to that layer (using `jumpToLayer`)
**And** the breadcrumb and URL update accordingly

**Given** the tree has more than 3 levels of depth
**When** the minimap renders
**Then** deep branches are collapsed by default
**And** the path to the current layer is always expanded

**Given** the minimap is integrated into StudioLayout
**When** the user toggles it
**Then** it appears as a sidebar panel that can be shown/hidden
**And** it does not interfere with the existing conversation/diagram panels

**Technical Notes:**

- New: `src/components/studio/LayerMinimap.tsx`
- Modify: `src/components/studio/StudioLayout.tsx` (integrate minimap toggle)
- Fetches tree via `GET /api/workspaces/[id]/layers`
- Uses `useLayerNavigation` hook from Story 9.3
- Requirements: FR-L3, AR-L3

### Story 9.5: Port Editor

As a user,
I want to manually add, edit, and remove I/O ports on composite nodes,
So that I can define the interface contract between a parent graph and its child layer.

**Acceptance Criteria:**

**Given** a composite node is selected in the diagram
**When** the user opens the Port Editor (via context menu or panel action)
**Then** a UI panel displays the current ports of the composite node's child LayerGraph
**And** each port shows: name, direction (input/output), optional type, and position order

**Given** the Port Editor is open
**When** the user clicks "Add Port"
**Then** a new port is added with default values (auto-generated name, direction "input")
**And** the user can edit all port fields inline

**Given** a port exists in the editor
**When** the user modifies its name, direction, or type
**Then** the change is saved via `PATCH /api/workspaces/[id]/layers/[layerId]` (ports field)
**And** the summary cache is invalidated

**Given** a port exists in the editor
**When** the user clicks "Remove" on a port
**Then** the port is removed from the ports array
**And** a confirmation is shown if edges reference this port

**Given** soft limits (max 10 ports per composite, AR-L9)
**When** the user adds a port that exceeds the limit
**Then** a warning is displayed but the operation is allowed

**Given** the ports are updated
**When** contract validation runs (async, debounced 2s)
**Then** any port↔edge inconsistencies are surfaced as warning badges

**Technical Notes:**

- New: `src/components/studio/PortEditor.tsx`
- Modify: `src/components/studio/DiagramContextMenu.tsx` (add "Edit Ports" action)
- Uses `PATCH /api/workspaces/[id]/layers/[layerId]` from Story 9.1
- Requirements: FR-L2, FR-L5 (manual part), AR-L2, AR-L9

## Epic 10: AI-Aware Layers

**Goal:** Enable the AI system (claudegraph) to understand and operate within the hierarchical layer context — building rich but bounded context, inferring port contracts, and validating consistency asynchronously.

### Story 10.1: AI Layer Context Builder

As a user,
I want the AI to understand my current position in the layer hierarchy when I chat,
So that its responses respect parent contracts, sibling context, and child interfaces.

**Acceptance Criteria:**

**Given** the user is editing a layer at depth N
**When** the AI processes a chat message (via studio-session.graph)
**Then** `buildLayerContext(layerGraphId)` is called and returns a `LayerContext` object containing:

- `current`: full JsonGraph + ports + name + depth
- `parent`: ports + sibling summaries (or null if root)
- `ancestors`: AI-generated summaries for grandparent and beyond (max 2 levels, NFR-L2)
- `children`: names + ports only (no internal graphs)

**Given** a LayerContext is built
**When** the AI prompt is constructed in `refine-flow.ts`
**Then** the layer context is injected following the prompt template pattern from the architecture document
**And** the prompt includes contract constraints ("respect these inputs/outputs")

**Given** a layer at depth > 2
**When** `buildLayerContext` fetches ancestor summaries
**Then** summaries are read from the `summary` field on LayerGraph (cached)
**And** if no cached summary exists, it is generated via `summary-generator.ts` and cached

**Given** the summary generator runs
**When** it generates a summary for a LayerGraph
**Then** the summary is stored in the `summary` field of that LayerGraph
**And** the summary is a concise text (1-3 sentences) describing the graph's purpose and key nodes

**Given** a LayerGraph's `graph` field is modified
**When** the update is saved
**Then** the `summary` field is set to null (cache invalidated — already in Story 9.1 PATCH)

**Given** the studio-session.graph state type
**When** layer awareness is added
**Then** `currentLayerId` and `layerStack` fields are included in the state
**And** the interact API route passes these from the request body

**Technical Notes:**

- New: `src/lib/layer/context-builder.ts`, `src/lib/layer/summary-generator.ts`
- Modify: `src/lib/ai/prompts/refine-flow.ts` (inject layer context)
- Modify: `src/lib/graphs/studio-session.graph.ts` (layer-aware state)
- Modify: `src/lib/graphs/studio-session.types.ts` (add currentLayerId, layerStack)
- Modify: `src/app/api/studio/[workspaceId]/interact/route.ts` (pass layer fields)
- Requirements: FR-L4, NFR-L2, AR-L5, AR-L12

### Story 10.2: AI Port Inference

As a user,
I want the AI to automatically suggest port contracts when I create a composite node,
So that I don't have to manually define every port from scratch.

**Acceptance Criteria:**

**Given** a node in the parent graph is being decomposed into a composite node
**When** the AI analyzes the parent graph context
**Then** it examines all edges connected to that node (incoming = input ports, outgoing = output ports)
**And** generates a suggested port list with inferred names, directions, and optional types

**Given** the AI has generated port suggestions
**When** the suggestions are presented to the user
**Then** they are shown as a preview (non-destructive) that the user can accept, modify, or reject
**And** the Port Editor (Story 9.5) is pre-populated with the suggestions if accepted

**Given** the user accepts AI-inferred ports
**When** the ports are saved
**Then** they are stored on the child LayerGraph via `PATCH /api/workspaces/[id]/layers/[layerId]`

**Given** the AI generates ports
**When** the total would exceed the soft limit (10 ports)
**Then** a warning is shown and the AI is prompted to consolidate ports

**Technical Notes:**

- Logic integrated into `context-builder.ts` or a new helper in `src/lib/layer/`
- Port inference runs when creating a child layer from a composite node
- Reuses `POST /api/workspaces/[id]/layers/[layerId]/child` from Story 9.1
- Requirements: FR-L5 (AI inference part), AR-L2, AR-L9

### Story 10.3: Async Contract Validation

As a user,
I want the system to automatically check port↔edge consistency after modifications,
So that I'm warned about contract violations without being blocked in my creative flow.

**Acceptance Criteria:**

**Given** the user modifies ports on a composite node or edges connected to a composite node
**When** the modification is saved
**Then** contract validation is triggered asynchronously after a 2-second debounce

**Given** contract validation runs
**When** `contract-validator.ts` checks the current layer
**Then** it verifies:

- Every input port has at least one incoming edge in the parent graph
- Every output port has at least one outgoing edge in the parent graph
- No edges reference non-existent ports
- Port types match edge semantics (if types are defined)

**Given** validation finds inconsistencies
**When** the results are returned
**Then** `ValidationWarning[]` objects are created with `{ nodeId, severity, message }`
**And** these are displayed as warning badges via the existing badge-renderer pattern
**And** warnings are non-blocking — the user can continue working

**Given** the AI generates or modifies a graph
**When** the AI response is applied
**Then** contract validation runs immediately (no debounce) to catch AI-generated violations

**Given** all ports and edges are consistent
**When** validation completes
**Then** any existing warning badges are cleared

**Technical Notes:**

- New: `src/lib/layer/contract-validator.ts`
- Reuses badge-renderer pattern from Story 7.3 (live review indicators)
- Debounce logic in StudioLayout (2s, similar to existing live-review)
- Requirements: FR-L7, AR-L8

## Epic 11: AI Structural Refactoring

**Goal:** Enable the AI to analyze a flat graph and propose hierarchical decomposition, with an interactive negotiation loop and atomic application backed by checkpoint-based rollback.

### Story 11.1: Restructure Proposal and Negotiation

As a user,
I want to ask the AI to analyze my flat graph and propose a layer decomposition,
So that I can restructure a complex graph into organized hierarchical layers through an interactive negotiation.

**Acceptance Criteria:**

**Given** the user has a flat graph (or existing hierarchy) they want to restructure
**When** they request restructuring via chat (e.g., "refacto pour délimiter les scopes avec différents Layers")
**Then** the `restructure-layers.graph` claudegraph is invoked with the current graph

**Given** the restructure graph starts
**When** the analyze step runs
**Then** it examines the graph structure and identifies candidate clusters of related nodes
**And** reports the analysis to the user via SSE

**Given** analysis is complete
**When** the propose step runs
**Then** it generates a `proposedClusters: Cluster[]` with:

- Cluster name (suggested composite node name)
- Nodes included in each cluster
- Suggested ports for each cluster (inferred from cross-cluster edges)
- Mode used: bottom-up, top-down, or hybrid

**Given** clusters are proposed
**When** the InteractionNode presents them to the user
**Then** the user can:

- Accept the proposal as-is
- Adjust clusters (move nodes between clusters, rename, split, merge)
- Reject and ask AI to re-propose with different constraints
- Choose `from_scratch: true` to rethink from zero

**Given** the user adjusts clusters
**When** the adjustments are submitted
**Then** the proposal is updated and re-presented for confirmation
**And** this loop continues until the user validates

**Given** the user requests restructuring with a specific mode
**When** the mode is `bottom-up`
**Then** the AI groups leaf nodes into clusters first, then builds parent layers
**When** the mode is `top-down`
**Then** the AI identifies major domains first, then assigns nodes to each
**When** the mode is `hybrid`
**Then** the AI uses a mix based on graph structure

**Given** the restructure endpoint
**When** `POST /api/ai/restructure` is called
**Then** it streams progress via SSE (analyzing → proposing → negotiating → applying → done)

**Technical Notes:**

- New: `src/lib/graphs/restructure-layers.graph.ts`
- New: `src/app/api/ai/restructure/route.ts`
- State type: `RestructureState` (from architecture document)
- InteractionNode for negotiation loop
- Requirements: FR-L6, NFR-L5, AR-L6

### Story 11.2: Atomic Apply with Checkpoint Restore

As a user,
I want the validated restructure proposal to be applied atomically with a pre-restructure checkpoint,
So that I can safely roll back if the result doesn't match my expectations.

**Acceptance Criteria:**

**Given** the user has validated a restructure proposal
**When** the apply step begins
**Then** a checkpoint tagged `"pre-restructure"` is automatically created via the existing checkpoint system (D7)
**And** the checkpoint captures the entire current state (all LayerGraphs for the workspace)

**Given** a checkpoint is created
**When** the atomic apply runs
**Then** for each cluster in the validated proposal:

1. A new child LayerGraph is created with the clustered nodes as its graph
2. The clustered nodes are replaced by a single composite node in the parent graph
3. Ports are set on the child LayerGraph based on cross-cluster edges
4. Cross-cluster edges are rewired to the composite node
   **And** all operations succeed or all are rolled back (transactional)

**Given** the restructure is applied
**When** the user views the result
**Then** the parent graph shows composite nodes where clusters were
**And** double-clicking a composite navigates to the child layer (using Story 9.3 navigation)
**And** port contracts are consistent (validated by Story 10.3)

**Given** the user is unhappy with the result
**When** they access the checkpoint timeline (existing `CheckpointTimeline.tsx`)
**Then** the `"pre-restructure"` checkpoint is visible
**And** restoring it reverts all LayerGraphs to their pre-restructure state

**Given** the restructure involves multiple layers
**When** the apply step processes the proposal
**Then** all layers are updated in a single database transaction
**And** if any step fails, the entire restructure is rolled back

**Given** the restructure completes successfully
**When** the status reaches 'done'
**Then** contract validation (Story 10.3) runs on all affected layers
**And** the UI updates to reflect the new hierarchical structure

**Technical Notes:**

- Extends `restructure-layers.graph.ts` from Story 11.1
- Reuses existing checkpoint system (`CheckpointTimeline.tsx`, checkpoint API)
- Prisma `$transaction` for atomicity
- Requirements: FR-L8, NFR-L5, AR-L7
