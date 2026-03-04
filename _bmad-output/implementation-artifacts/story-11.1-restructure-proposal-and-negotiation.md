# Story 11.1 — Restructure Proposal and Negotiation

## Status: review

## Story

**As a** user,
**I want** to ask the AI to analyze my flat graph and propose a layer decomposition,
**So that** I can restructure a complex graph into organized hierarchical layers through an interactive negotiation.

---

## Acceptance Criteria

1. **Given** the user has a flat graph (or existing hierarchy) they want to restructure
   **When** they request restructuring via chat (e.g., "refacto pour délimiter les scopes avec différents Layers")
   **Then** the `restructure-layers.graph` claudegraph is invoked with the current graph

2. **Given** the restructure graph starts
   **When** the analyze step runs
   **Then** it examines the graph structure and identifies candidate clusters of related nodes
   **And** reports the analysis to the user via SSE

3. **Given** analysis is complete
   **When** the propose step runs
   **Then** it generates a `proposedClusters: Cluster[]` with:
   - Cluster name (suggested composite node name)
   - Nodes included in each cluster
   - Suggested ports for each cluster (inferred from cross-cluster edges)
   - Mode used: bottom-up, top-down, or hybrid

4. **Given** clusters are proposed
   **When** the InteractionNode presents them to the user
   **Then** the user can:
   - Accept the proposal as-is
   - Adjust clusters (move nodes between clusters, rename, split, merge)
   - Reject and ask AI to re-propose with different constraints
   - Choose `from_scratch: true` to rethink from zero

5. **Given** the user adjusts clusters
   **When** the adjustments are submitted
   **Then** the proposal is updated and re-presented for confirmation
   **And** this loop continues until the user validates

6. **Given** the user requests restructuring with a specific mode
   **When** the mode is `bottom-up`
   **Then** the AI groups leaf nodes into clusters first, then builds parent layers
   **When** the mode is `top-down`
   **Then** the AI identifies major domains first, then assigns nodes to each
   **When** the mode is `hybrid`
   **Then** the AI uses a mix based on graph structure

7. **Given** the restructure endpoint
   **When** `POST /api/ai/restructure` is called
   **Then** it streams progress via SSE (analyzing → proposing → negotiating → applying → done)

---

## Technical Notes

- New: `src/lib/graphs/restructure-layers.graph.ts`
- New: `src/app/api/ai/restructure/route.ts`
- State type: `RestructureState`
- InteractionNode (AskHumanNode) for negotiation loop
- Requirements: FR-L6, NFR-L5, AR-L6

---

## Implementation Tasks

### 1. Types — `RestructureState` and `Cluster` [x]

- Define `Cluster` type: `{ id: string; name: string; nodeIds: string[]; suggestedPorts: SuggestedPort[] }`
- Define `SuggestedPort` type: `{ name: string; direction: 'input' | 'output'; connectedNodeId: string }`
- Define `RestructureMode` type: `'bottom-up' | 'top-down' | 'hybrid'`
- Define `RestructureState` interface:
  - `workspaceId: string`
  - `graph: JsonGraph` — the flat graph to restructure
  - `mode: RestructureMode`
  - `language: string`
  - `proposedClusters?: Cluster[]`
  - `analysisNotes?: string` — text summary of analysis findings
  - `userFeedback?: string` — latest user adjustment message
  - `negotiationRound: number` — increments on each re-proposal
  - `finalClusters?: Cluster[]` — validated clusters after user confirmation
  - `fromScratch?: boolean` — user requested full re-think
  - `error?: string`
- Place types in `src/lib/graphs/restructure-layers.types.ts`

### 2. `src/lib/graphs/restructure-layers.graph.ts` [x]

- Create claudegraph with nodes: `analyze` → `propose` → `present (AskHumanNode)` → routing via `onAnswer` → `apply` → END
- **`analyze` (FnNode)**: extract node list, edge list, identify leaf nodes vs hub nodes, compute node connectivity degree
- **`propose` (LLMNode)**: using `claude-opus-4-6`, prompt to group nodes into clusters based on `mode`; output schema: `{ clusters: Cluster[], analysisNotes: string }`
- **`present` (AskHumanNode)**: format clusters as human-readable text using `key`/`request`/`onAnswer` API; routing logic integrated into `onAnswer.next`:
  - `accept` / `yes` / `ok` → `next: 'apply'`
  - "rethink" / "from scratch" → `next: 'propose'` with `fromScratch: true`
  - Otherwise (adjustments text) → `next: 'propose'` with `userFeedback` set
- **`propose` refinement**: when `userFeedback` is set, include it in LLM prompt as constraint; when `fromScratch`, start fresh without prior cluster context
- **`apply` (FnNode)**: convert validated `finalClusters` into graph mutations — composite nodes, remap/deduplicate edges
- Graph edges: `analyze` → `propose` → `present` (routes via `onAnswer`) → `apply` → END

### 3. `src/app/api/ai/restructure/route.ts` [x]

- `POST` handler, body: `{ workspaceId, graph, mode?, sessionId?, language?, checkpoint?, userAnswer? }`
- Validate with Zod: `workspaceId` required, `graph` required, `mode` optional (default `'hybrid'`), `language` optional (default `'English'`)
- Instantiate `RestructureState` and run `restructure-layers.graph` via `GraphRunner + InMemoryRunStore`
- Stream SSE progress: emit `restructure-progress` events at each phase
- On `AskHumanNode` pause: emit `interaction` event and return `{ type: 'paused', checkpoint }`
- On resume (subsequent POST with `checkpoint + userAnswer`): resume runner with user answer
- Return `{ type: 'done', clusters, updatedGraph? }` on completion

### 4. Intent detection in `studio-session.graph.ts` [x]

- Added restructure intent detection in `classifyIntent`: detect keywords like "refacto", "restructure", "reorganize", "layer decomposition", "délimiter", "scopes"

### 5. StudioLayout integration [x]

- Handle new SSE event type `restructure-progress` in the SSE event processor
- Display restructure progress as chat messages
- `sse.types.ts`: Added `restructure-progress` to SSEEventType, `RestructureProgressPayload` interface, `RestructureStep` type

---

## Dev Notes

- Follow the exact same claudegraph pattern as `src/lib/ai/graphs/live-review.graph.ts` (FnNode + LLMNode + AskHumanNode)
- The `AskHumanNode` (= InteractionNode) must pause execution and emit an SSE `interaction` event; resumption follows the same checkpoint pattern as `studio-session.graph.ts`
- LLM prompt for `propose` must include: full node list with connectivity info, mode instruction, prior `analysisNotes`, and any `userFeedback` from previous rounds
- `apply` FnNode converts clusters to composite nodes using the `JsonGraph` patch model — add composite nodes with `type: 'composite'`, remove original nodes that are now inside clusters, reroute cross-cluster edges to the composite node IDs
- Port suggestions for each cluster come from edges that cross cluster boundaries (edge from cluster A node → cluster B node = cluster A needs an output port, cluster B needs an input port)
- The negotiation round counter prevents infinite loops: cap at 5 rounds then force confirmation
- SSE streaming uses `sessionId` routing (existing infrastructure); no new SSE transport needed

---

## Dev Agent Record

### Files Changed

- `src/lib/graphs/restructure-layers.types.ts` — NEW: `RestructureMode`, `SuggestedPort`, `Cluster`, `RestructureState` types
- `src/lib/graphs/restructure-layers.graph.ts` — NEW: claudegraph with analyze/propose/present(AskHumanNode)/apply nodes; routing via `onAnswer.next` (no separate route-feedback FnNode needed)
- `src/app/api/ai/restructure/route.ts` — NEW: POST handler, Zod validation, GraphRunner + InMemoryRunStore, checkpoint resume, SSE progress via sessionEventBus
- `src/lib/sse/sse.types.ts` — Added `'restructure-progress'` to SSEEventType, `RestructureStep` type, `RestructureProgressPayload` interface, mapping in SSEEventMap
- `src/lib/graphs/studio-session.graph.ts` — Added `'restructure'` intent with French/English keyword detection
- `src/components/studio/StudioLayout.tsx` — Added `restructure-progress` SSE event handler

### Notes

- `AskHumanNode` API requires `key`/`request`/`onAnswer` — the `prompt` shorthand does NOT exist. Routing to next node is done via `onAnswer`'s `{ next: string }` return, eliminating the need for a separate `route-feedback` FnNode.
- `_nextNode` field removed from `RestructureState` — no longer needed since routing is in `onAnswer.next`.
- Pre-existing TypeScript errors (6 total in Zod v4 `.errors` → `.issues` migration and spec-output.ts) are unrelated to this story.
