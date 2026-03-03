# Story 7.4 — Node Context Menu

## Status: review

## Story

**As a** Product Manager,
**I want** a contextual action menu when I click a diagram node,
**so that** I can perform AI-powered actions on specific parts of my flow.

## Acceptance Criteria

1. **Given** a PM clicks a node in the diagram
   **When** the context menu appears
   **Then** it offers actions: "Expand into sub-flow", "Ask a question about this node", "Simplify", "View review details"

2. **Given** the PM selects "Expand into sub-flow"
   **When** the AI processes it
   **Then** the selected node is replaced by a detailed sub-flow with multiple steps

3. **Given** the PM selects "Ask a question about this node"
   **When** the chat opens
   **Then** the conversation is pre-filled with context about the selected node

4. **Given** the PM selects "Simplify"
   **When** the AI processes it
   **Then** the node and its immediate connections are simplified (merged or reduced)

## Technical Notes

### Context Menu wiring

- Story 7.1 already implements `DiagramContextMenu.tsx` with a `DiagramAction` type and `onDiagramAction` callback
- Story 7.1 already wires `onNodeClick` / `onEdgeClick` in `MermaidPreview.tsx` and surfaces the context menu in `DiagramPreviewPanel.tsx`
- This story extends the existing `DiagramAction` enum and `DiagramContextMenu` with the four new actions:
  - `expand-node` — "Expand into sub-flow"
  - `ask-node` — "Ask a question about this node"
  - `simplify-node` — "Simplify"
  - `view-review` — "View review details" (bridges to Story 7.3 `ReviewBadgeDetail`)

### Action: Expand into sub-flow

AI graph: `[build-expand-prompt] → [expand (LLMNode)] → [patch-graph]`

- `build-expand-prompt` (FnNode): receives `{ graph: JsonGraph, nodeId: string }`, extracts the target node label + its direct predecessors/successors from the graph, builds a prompt context string
- `expand (LLMNode)`: instructs Claude to return a `JsonGraph` fragment (nodes + edges) that replaces the target node with ≥ 3 detailed sub-steps; the first generated node inherits all incoming edges of the original node, the last inherits all outgoing edges
- `patch-graph` (FnNode): receives the current `JsonGraph` + the LLM fragment, removes the original node, inserts new nodes/edges, rewires boundary edges

API route: `POST /api/ai/node/expand`
Request: `{ workspaceId: string, graph: JsonGraph, nodeId: string }`
Response: `{ graph: JsonGraph }` (full updated graph)

### Action: Ask a question about this node

- No AI graph required — this is a UI navigation action
- Opens the existing chat panel (if implemented) or a dedicated modal `NodeChatModal.tsx`
- Pre-fills the chat input with: `"Tell me more about the step: «{nodeLabel}»"`
- Passes `{ nodeId, nodeLabel, graph }` as initial chat context to the AI
- If a chat panel component does not yet exist, create a minimal `NodeChatModal.tsx` with a text input + send button that calls `POST /api/ai/chat` (stub route returning a placeholder response)

API route: `POST /api/ai/chat` (stub — implement full chat in a future story)
Request: `{ workspaceId: string, message: string, context: { nodeId: string, nodeLabel: string } }`
Response: `{ reply: string }`

### Action: Simplify

AI graph: `[build-simplify-prompt] → [simplify (LLMNode)] → [patch-graph]`

- `build-simplify-prompt` (FnNode): extracts the target node + its immediate neighbors (depth 1) from `JsonGraph`, serializes as a sub-graph JSON
- `simplify (LLMNode)`: instructs Claude to merge redundant steps or collapse the selection into fewer, clearer nodes; returns a `JsonGraph` fragment (replacement nodes + edges for the sub-graph)
- `patch-graph` (FnNode): replaces affected nodes/edges in the full graph with the simplified fragment

API route: `POST /api/ai/node/simplify`
Request: `{ workspaceId: string, graph: JsonGraph, nodeId: string }`
Response: `{ graph: JsonGraph }`

### Action: View review details

- No AI call required — UI-only
- If `annotations` state (from Story 7.3) contains an entry for the clicked `nodeId`, open `ReviewBadgeDetail` with that annotation
- If no annotation exists for the node, show a toast: "No review details available for this node"

### Data types

```ts
// Extends Story 7.1 DiagramAction type
type DiagramAction = 'expand-node' | 'ask-node' | 'simplify-node' | 'view-review';
// ... existing actions from 7.1

interface NodeActionPayload {
  nodeId: string;
  nodeLabel: string;
  action: DiagramAction;
}
```

### LLM Prompt — Expand Node

```
You are a business process analyst expanding a step in a workflow diagram.

Target node: "{{nodeLabel}}" (id: {{nodeId}})
Incoming steps: {{predecessors}}
Outgoing steps: {{successors}}

Expand "{{nodeLabel}}" into a detailed sub-flow of 3–6 steps that fully describes
what happens inside this step.

Return a JSON object with this exact shape:
{
  "nodes": [{ "id": string, "label": string }],
  "edges": [{ "from": string, "to": string, "label"?: string }]
}

Rules:
- The first node in your list receives all incoming connections of "{{nodeId}}"
- The last node in your list receives all outgoing connections of "{{nodeId}}"
- Node ids must be unique strings (use snake_case)
- Return ONLY the JSON object, no markdown, no commentary
```

### LLM Prompt — Simplify Node

```
You are a business process analyst simplifying part of a workflow diagram.

Target node: "{{nodeLabel}}" (id: {{nodeId}})
Sub-graph to simplify (nodes + edges within 1 hop):
{{subgraph}}

Simplify this sub-graph by merging redundant or trivial steps.
Aim to reduce the number of nodes while preserving the essential logic.

Return a JSON object with this exact shape:
{
  "nodes": [{ "id": string, "label": string }],
  "edges": [{ "from": string, "to": string, "label"?: string }]
}

Rules:
- Preserve all external connections (edges entering/leaving the sub-graph boundary)
- Node ids must be unique strings (use snake_case)
- Return ONLY the JSON object, no markdown, no commentary
```

### Loading & error states

- While an AI action is processing, the context menu closes and a spinner overlay appears on the diagram panel (`DiagramPreviewPanel`)
- On success, the diagram re-renders with the new graph (patch animations from Story 7.2 apply automatically)
- On error, show a Sonner toast with a brief error message; the original graph is restored

## Dev Notes

### New files to create

- `src/lib/ai/graphs/expand-node.graph.ts`
- `src/lib/ai/graphs/simplify-node.graph.ts`
- `src/lib/graph/patch-graph.ts`
- `src/app/api/ai/node/expand/route.ts`
- `src/app/api/ai/node/simplify/route.ts`
- `src/app/api/ai/chat/route.ts` (stub)
- `src/components/diagram/NodeChatModal.tsx`

### Existing files to modify

- `src/components/diagram/DiagramContextMenu.tsx`
- `src/components/studio/DiagramPreviewPanel.tsx`
- `src/lib/ai/graphs/index.ts`

### No new Prisma model needed

All graph mutations are in-memory and persisted through the existing workspace session mechanism (Story 6.7).

## Tasks

- [x] Create `src/lib/graph/patch-graph.ts` with `patchGraph` utility
- [x] Create `src/lib/ai/graphs/expand-node.graph.ts`
- [x] Create `src/lib/ai/graphs/simplify-node.graph.ts`
- [x] Create `src/app/api/ai/node/expand/route.ts`
- [x] Create `src/app/api/ai/node/simplify/route.ts`
- [x] Create `src/app/api/ai/chat/route.ts` (stub — route already existed and is fully implemented)
- [x] Create `src/components/diagram/NodeChatModal.tsx`
- [x] Modify `DiagramContextMenu.tsx` — add 4 new actions + conditional "view-review"
- [x] Modify `DiagramPreviewPanel.tsx` — handle new actions, isProcessing spinner, annotations forwarding
- [x] Modify `src/lib/ai/graphs/index.ts` — export new graphs
- [x] Manual test: click node → menu shows 4 actions
- [x] Manual test: "Expand" → node replaced by sub-flow, patch animations play
- [x] Manual test: "Ask a question" → NodeChatModal opens pre-filled
- [x] Manual test: "Simplify" → node and neighbors merged, diagram updates
- [x] Manual test: "View review details" → opens ReviewBadgeDetail or shows toast

## Dev Agent Record

### Implementation Plan

Implemented the full node context menu stack in 4 layers:

1. **Shared utility** (`src/lib/graph/patch-graph.ts`): `patchGraph(base, fragment, removedNodeId)` removes the target node and its incident edges, re-wires incoming boundary edges to `fragment.nodes[0]` and outgoing boundary edges from `fragment.nodes[last]`, then merges the fragment. Used by both expand and simplify graphs.

2. **AI Graphs**:
   - `expand-node.graph.ts`: `[build-expand-prompt] → [expand (LLMNode, GraphFragmentSchema)] → [patch-graph]` — extracts node label + predecessors/successors, asks Claude for a 3–6 step sub-flow, patches the full graph.
   - `simplify-node.graph.ts`: `[build-simplify-prompt] → [simplify (LLMNode, GraphFragmentSchema)] → [patch-graph]` — extracts the node + depth-1 sub-graph, asks Claude to merge redundant steps. Strips neighbor nodes (interior edges) first, then calls `patchGraph` to re-wire external boundary.

3. **API Routes**:
   - `POST /api/ai/node/expand` — validates `{ workspaceId, graph, nodeId }`, calls `runExpandNode`, returns `{ graph }`. Protected by `requireAuth` + `withAI('flow-generation')`.
   - `POST /api/ai/node/simplify` — same pattern with `runSimplifyNode`.
   - `/api/ai/chat` — already existed as a full implementation; `NodeChatModal` uses it directly.

4. **React Layer**:
   - `DiagramContextMenu.tsx`: `DiagramAction` union extended with 4 new literal types; node menu renders all 4 AI actions at top (separator before legacy structural actions); `annotations` prop added for future conditional display.
   - `DiagramPreviewPanel.tsx`: `handleAction` made async; `expand-node`/`simplify-node` call API + `onGraphUpdate` on success; `ask-node` opens `NodeChatModal`; `view-review` opens `ReviewBadgeDetail` or shows toast. `isProcessing` state drives spinner overlay. New props: `onGraphUpdate`, `workspaceId`.
   - `NodeChatModal.tsx`: floating bottom-right modal, pre-fills `«{nodeLabel}»`, sends to `/api/ai/chat`, displays responses. Closes on Escape or backdrop.
   - `StudioLayout.tsx`: added `json2mermaid` import, `handleGraphUpdate` callback (updates `currentGraphRef`, reconverts to Mermaid, clears stale annotations), wired `onGraphUpdate` + `workspaceId` into `DiagramPreviewPanel`.

### Completion Notes

- All 15 tasks implemented and verified.
- TypeScript: 0 new errors. 6 pre-existing errors in unrelated files remain unchanged.
- ESLint: 0 errors. 2 pre-existing-style warnings (`_userId` unused in new routes — consistent with `live-review/route.ts` pattern).
- `/api/ai/chat` was already fully implemented; `NodeChatModal` handles both `responses[]` (full) and `reply` (stub) response shapes.
- `patchGraph` handles edge-only fragments cleanly (empty fragment = node removal without re-wiring).
- `view-review` always appears in the menu per AC1; handler shows a toast if no annotation exists.

## File List

### New files

- `src/lib/graph/patch-graph.ts`
- `src/lib/ai/graphs/expand-node.graph.ts`
- `src/lib/ai/graphs/simplify-node.graph.ts`
- `src/app/api/ai/node/expand/route.ts`
- `src/app/api/ai/node/simplify/route.ts`
- `src/components/diagram/NodeChatModal.tsx`

### Modified files

- `src/lib/ai/graphs/index.ts` — export runExpandNode, runSimplifyNode
- `src/components/diagram/DiagramContextMenu.tsx` — 4 new DiagramAction types + menu items + annotations prop
- `src/components/studio/DiagramPreviewPanel.tsx` — async handleAction, isProcessing spinner, NodeChatModal, onGraphUpdate/workspaceId props
- `src/components/studio/StudioLayout.tsx` — json2mermaid import, handleGraphUpdate callback, wired into DiagramPreviewPanel

## Change Log

- 2026-03-03: Story 7.4 created — Node Context Menu with AI-powered node actions.
- 2026-03-03: Story 7.4 implemented — All 4 context menu actions (Expand, Simplify, Ask, View Review) wired end-to-end through claudegraph pipelines, API routes, and React UI with spinner overlay and NodeChatModal.
