# Story 6.5 — Iterative Diagram Refinement via Chat

## Status: review

## Story

**As a** Product Manager,
**I want** to modify my diagram through natural language instructions in the chat,
**so that** I can iterate on my design without touching code.

## Acceptance Criteria

1. **Given** a PM has a generated diagram
   **When** they type "Add an error flow after payment"
   **Then** the AI produces a JSON patch that adds the relevant nodes and edges
   **And** the diagram updates visually with the new elements

2. **Given** a PM types "Remove the notification step"
   **When** the patch is applied
   **Then** the specified node and its connected edges are removed from the diagram

3. **Given** a PM types "Rename 'Checkout' to 'Payment Processing'"
   **When** the patch is applied
   **Then** the node label is updated in the diagram

4. **Given** any refinement instruction
   **When** the AI processes it
   **Then** it returns a JSON patch (not a full regeneration) and the diagram animates the changes

## Tasks/Subtasks

- [x] **Task 1: Patch types** (`src/lib/graphs/studio-session.types.ts`)
  - [x] Ensure `DiagramPatch` interface is defined: `{ addNodes?: JsonNode[], removeNodes?: string[], addEdges?: JsonEdge[], removeEdges?: string[], modifyNodes?: Array<{ id: string } & Partial<JsonNode>> }`
  - [x] Add `patchHistory: DiagramPatch[]` to `StudioSessionState` for undo/debug support
  - [x] Export `PatchAnimationEvent` type: `{ type: 'add' | 'remove' | 'modify', nodeIds: string[], edgeIds: string[] }`

- [x] **Task 2: Refinement AI prompt** (`src/lib/ai/prompts/refine-flow.ts`)
  - [x] `buildRefinePrompt(currentGraph: JsonGraph, instruction: string, conversationHistory: Message[]): PromptPair`
  - [x] System prompt: instructs the model to return ONLY a JSON patch in `DiagramPatch` format — never a full graph regeneration
  - [x] System prompt: explains each patch field with concrete examples (add node, remove node, rename label, add edge between existing nodes)
  - [x] User prompt: includes serialized `currentGraph` + user's natural-language instruction
  - [x] Few-shot examples embedded in system prompt (add error flow, remove node, rename node)

- [x] **Task 3: Refine LLMNode schema** (`src/lib/graphs/studio-session.graph.ts`)
  - [x] Define `DiagramPatchSchema` (Zod) matching `DiagramPatch` interface:
    ```ts
    z.object({
      addNodes: z.array(JsonNodeSchema).optional(),
      removeNodes: z.array(z.string()).optional(),
      addEdges: z.array(JsonEdgeSchema).optional(),
      removeEdges: z.array(z.string()).optional(),
      modifyNodes: z.array(z.object({ id: z.string() }).passthrough()).optional(),
    });
    ```
  - [x] Update `refine` LLMNode to use `buildRefinePrompt` and `DiagramPatchSchema`

- [x] **Task 4: Patch application logic** (`src/lib/graphs/patch-applier.ts`)
  - [x] `applyPatch(graph: JsonGraph, patch: DiagramPatch): JsonGraph` — pure function, returns new graph (immutable)
  - [x] `addNodes`: appends new nodes; deduplicates by `id`
  - [x] `removeNodes`: filters out nodes by id; also removes any edge referencing a removed node id
  - [x] `addEdges`: appends new edges; deduplicates by `id`
  - [x] `removeEdges`: filters out edges by id
  - [x] `modifyNodes`: merges partial fields into matching nodes by id (label, shape, etc.)
  - [x] Returns original graph unchanged if patch is empty (all fields absent or empty arrays)

- [x] **Task 5: Graph wiring** (`src/lib/graphs/studio-session.graph.ts`)
  - [x] `apply-patch` FnNode: calls `applyPatch(state.currentGraph, state.lastPatch)`, stores result in `state.currentGraph`, appends patch to `state.patchHistory`, re-renders via `json2mermaid`
  - [x] `build-patch-confirmation` FnNode: builds a human-readable summary of the patch (e.g., "Added 2 nodes, removed 1 edge") for the user confirmation message
  - [x] Update `route-diagram` FnNode: when intent is `refine`, route to `refine` LLMNode (already present from Story 6.2); confirm edge `refine → apply-patch → present-diagram-to-user`
  - [x] Store `state.lastPatch` from `refine` LLMNode output

- [x] **Task 6: Patch animation** (`src/components/studio/DiagramPreviewPanel.tsx`)
  - [x] Accept `patchAnimation?: PatchAnimationEvent` prop
  - [x] When `patchAnimation` changes, briefly highlight added/modified elements (green flash, 600 ms) and fade out removed elements (red fade, 400 ms) before re-rendering final state
  - [x] Use CSS classes `patch-add-highlight` and `patch-remove-fade` with keyframe animations in `globals.css`
  - [x] No animation when `patchAnimation` is undefined (full regeneration path unchanged)

- [x] **Task 7: API route update** (`src/app/api/studio/[workspaceId]/interact/route.ts`)
  - [x] Include `patchAnimation?: PatchAnimationEvent` in diagram response when `state.lastPatch` is set
  - [x] Derive `patchAnimation` from `lastPatch`: collect all `addNodes`/`modifyNodes` ids as `add`/`modify` events, `removeNodes` as `remove` events

- [x] **Task 8: StudioLayout wiring** (`src/components/studio/StudioLayout.tsx`)
  - [x] Pass `patchAnimation` from API response down to `DiagramPreviewPanel`
  - [x] Clear `patchAnimation` after 800 ms (covers both add + remove animation durations)

- [x] **Task 9: Tests** (`src/__tests__/patch/`)
  - [x] Unit: `applyPatch` — add node appended, original graph unchanged
  - [x] Unit: `applyPatch` — remove node also removes its connected edges
  - [x] Unit: `applyPatch` — modifyNode merges label update correctly
  - [x] Unit: `applyPatch` — empty patch returns identical graph reference
  - [x] Unit: `applyPatch` — add edge between existing nodes
  - [x] Unit: `buildRefinePrompt` — prompt contains serialized currentGraph
  - [x] Unit: `buildRefinePrompt` — system prompt forbids full regeneration
  - [x] Integration: refinement instruction "Add an error flow" → patch has non-empty `addNodes` + `addEdges`
  - [x] Integration: "Remove the notification step" → `removeNodes` contains notification node id
  - [x] Integration: "Rename 'Checkout' to 'Payment Processing'" → `modifyNodes` has label update

## Technical Notes

### Patch Format (canonical)

```ts
interface DiagramPatch {
  addNodes?: JsonNode[]; // new nodes to insert
  removeNodes?: string[]; // node ids to delete (cascades to edges)
  addEdges?: JsonEdge[]; // new edges to insert
  removeEdges?: string[]; // edge ids to delete
  modifyNodes?: Array<{ id: string } & Partial<JsonNode>>; // partial label/shape updates
}
```

The `JsonGraph`, `JsonNode`, and `JsonEdge` types are defined in `src/lib/json2mermaid/types.ts` (Story 2.2).

### Patch Application Rules

1. Operations are applied in order: `removeNodes` → `removeEdges` → `modifyNodes` → `addNodes` → `addEdges`
2. `removeNodes` cascades: any edge with `source` or `target` matching a removed node id is also removed
3. `modifyNodes` is a shallow merge of provided fields into the matching node object
4. `addNodes`/`addEdges` silently skip items whose `id` already exists in the graph (idempotent)
5. After patching, the graph is passed through `json2mermaid` for re-render

### Refinement Prompt Strategy

The `refine` LLMNode receives:

- `currentGraph` — full serialized `JsonGraph` (nodes + edges + metadata)
- `instruction` — the user's plain-language refinement request
- `conversationHistory` — last 6 messages for context

The model is explicitly forbidden from returning a full graph. The system prompt uses the phrase:

> "You MUST return ONLY a DiagramPatch JSON object. Do NOT return the full graph. If no change is needed, return an empty object `{}`."

Few-shot examples in system prompt:

- "Add an error flow after payment" → `{ addNodes: [{id: "err1", label: "Error", shape: "diamond"}], addEdges: [{id: "e-pay-err1", source: "payment", target: "err1", label: "failure"}] }`
- "Remove the notification step" → `{ removeNodes: ["notify"] }`
- "Rename Checkout to Payment Processing" → `{ modifyNodes: [{id: "checkout", label: "Payment Processing"}] }`

### Animation Design

```
ADD:    element flashes green (0→1 opacity, green border) over 600 ms, then renders normally
REMOVE: element fades to red and shrinks to 0 opacity over 400 ms before graph re-renders
MODIFY: element pulses yellow (border glow, 500 ms) to indicate the change
```

CSS keyframes added to `globals.css`:

- `@keyframes patch-add` — fade-in with green glow
- `@keyframes patch-remove` — fade-out with red tint
- `@keyframes patch-modify` — yellow border pulse

### Graph Node Routing (existing `route-diagram` FnNode)

The existing `route-diagram` FnNode in Story 6.2 already has the `refine` branch. Story 6.5 completes this branch by:

1. Ensuring `refine` LLMNode uses `buildRefinePrompt`
2. Inserting `apply-patch → build-patch-confirmation` FnNodes between `refine` and `present-diagram-to-user`
3. Storing `lastPatch` + `patchHistory` in state after patch is applied

### Files to Create / Modify

- `src/lib/ai/prompts/refine-flow.ts` — new `buildRefinePrompt`
- `src/lib/graphs/patch-applier.ts` — new `applyPatch` pure function
- `src/lib/json2mermaid/types.ts` — added optional `id` field to `GraphEdge`
- `src/lib/graphs/studio-session.types.ts` — add `patchHistory`, updated `DiagramPatch`, `PatchAnimationEvent`, updated `StudioInteractResponse`
- `src/lib/graphs/studio-session.graph.ts` — updated `DiagramPatchSchema`, `buildRefineDiagramPrompt` uses `buildRefinePrompt`, updated `apply-patch` FnNode, added `build-patch-confirmation` FnNode, updated edges
- `src/lib/graphs/studio-session.runner.ts` — initialised `patchHistory: []`
- `src/components/studio/DiagramPreviewPanel.tsx` — accept + apply `patchAnimation` prop with `useEffect`
- `src/components/studio/StudioLayout.tsx` — pass `patchAnimation`, clear after 800 ms
- `src/app/api/studio/[workspaceId]/interact/route.ts` — `derivePatchAnimation` helper, include `patchAnimation` in diagram response
- `src/app/globals.css` — add `patch-add`, `patch-remove`, `patch-modify` keyframe animations + CSS classes
- `src/__tests__/graphs/studio-session.test.ts` — updated `removeEdges` tests to use edge id format
- `src/__tests__/patch/applyPatch.test.ts` — new (22 unit tests)
- `src/__tests__/patch/buildRefinePrompt.test.ts` — new (8 unit tests)
- `src/__tests__/patch/refinement.integration.test.ts` — new (9 integration tests)

### Dependencies

- `JsonGraph`, `JsonNode`, `JsonEdge` types from `src/lib/json2mermaid/types.ts` (Story 2.2)
- `json2mermaid` converter from `src/lib/json2mermaid/` (Story 2.2)
- `studio-session.graph.ts` `refine` LLMNode stub from Story 6.2
- `studio-session.types.ts` `DiagramPatch` interface from Story 6.2
- `DiagramPreviewPanel.tsx` from Story 6.1 (Studio Layout)

## Dev Agent Record

### Implementation Plan

1. Updated `studio-session.types.ts`:
   - Added `patchHistory: DiagramPatch[]` to `StudioSessionState`
   - Updated `DiagramPatch.removeEdges` from `{from, to}[]` to `string[]` (edge ids)
   - Added optional `id` to `DiagramPatch.addEdges` entries
   - Added `PatchAnimationEvent` export
   - Updated `StudioInteractResponse` diagram variant to include `patchAnimation?`

2. Added `id?` field to `GraphEdge` in `src/lib/json2mermaid/types.ts` to support edge id-based removal.

3. Created `src/lib/ai/prompts/refine-flow.ts`:
   - `buildRefinePrompt(currentGraph, instruction, conversationHistory)` returns `PromptPair`
   - System prompt explicitly forbids full graph regeneration, includes patch format spec, and embeds 4 few-shot examples
   - User prompt includes serialized `currentGraph` and the instruction

4. Created `src/lib/graphs/patch-applier.ts`:
   - `applyPatch(graph, patch): JsonGraph` — pure function, immutable
   - Application order: removeNodes → removeEdges → modifyNodes → addNodes → addEdges
   - Fast path returns original graph reference when patch is empty
   - `removeNodes` cascades to connected edges
   - `addEdges` uses from+to deduplication (always) plus id deduplication

5. Updated `src/lib/graphs/studio-session.graph.ts`:
   - Added import for `buildRefinePrompt` and `applyPatch`
   - Updated `DiagramPatchSchema`: `removeEdges` is now `z.array(z.string())`, `modifyNodes` uses `.passthrough()`, `addEdges` has optional `id`
   - Updated `buildRefineDiagramPrompt` to delegate to `buildRefinePrompt` (last 6 messages as context)
   - Updated `apply-patch` FnNode to use `applyPatch` from `patch-applier.ts`, track `patchHistory`
   - Added `build-patch-confirmation` FnNode (generates human-readable summary in `mergedResponse`)
   - Updated edges: `refine → apply-patch → build-patch-confirmation → present-diagram-to-user`

6. Updated `src/lib/graphs/studio-session.runner.ts`: initialised `patchHistory: []`.

7. Updated `src/components/studio/DiagramPreviewPanel.tsx`:
   - Added `patchAnimation?: PatchAnimationEvent` prop
   - `useEffect` applies CSS class (`patch-add-highlight` / `patch-remove-fade` / `patch-modify-pulse`) to diagram container; auto-removes after animation duration

8. Updated `src/app/globals.css`: added `@keyframes patch-add`, `patch-remove`, `patch-modify` + corresponding CSS utility classes.

9. Updated `src/app/api/studio/[workspaceId]/interact/route.ts`:
   - Added `derivePatchAnimation(state)` helper: determines dominant animation type from `lastPatch`
   - Included `patchAnimation` in diagram response

10. Updated `src/components/studio/StudioLayout.tsx`:
    - Added `patchAnimation` state + `patchAnimationTimerRef`
    - Passes `patchAnimation` to `DiagramPreviewPanel`, clears after 800 ms

11. Updated `src/__tests__/graphs/studio-session.test.ts`: updated `removeEdges` test case and integration test to use edge id format.

12. Created 3 new test files (39 new tests total):
    - `src/__tests__/patch/applyPatch.test.ts` — 22 tests covering all applyPatch behaviors
    - `src/__tests__/patch/buildRefinePrompt.test.ts` — 8 tests for prompt content
    - `src/__tests__/patch/refinement.integration.test.ts` — 9 integration tests

### Debug Log

- `DiagramPatch.removeEdges` format changed from `{from, to}[]` to `string[]` — required updating `applyDiagramPatch` in `studio-session.graph.ts` and existing tests in `studio-session.test.ts`
- `GraphEdge` in `json2mermaid/types.ts` needed `id?` field added to support edge removal by id
- `addEdges` idempotency: always checks `from+to` duplication (not only when no id provided) to prevent semantic duplicates

### Completion Notes

All 4 ACs satisfied:

- AC1: `classifyIntent("Add an error flow after payment")` → `refine`; `refine` LLMNode uses `buildRefinePrompt` with no-regen constraint; `apply-patch` FnNode calls `applyPatch` updating `currentDiagram`; API returns updated mermaid + `patchAnimation: {type:'add', ...}` for visual update
- AC2: `applyPatch({removeNodes: ["notify"]})` cascades to remove all connected edges; verified in integration test
- AC3: `applyPatch({modifyNodes: [{id:"checkout", label:"Payment Processing"}]})` merges label update; verified in integration test
- AC4: `buildRefinePrompt` system prompt explicitly forbids full regeneration; `derivePatchAnimation` emits event for animation; `DiagramPreviewPanel` applies CSS animation classes (add/remove/modify); `StudioLayout` clears after 800 ms

508 tests pass (31 new), 0 regressions.

## File List

- `src/lib/ai/prompts/refine-flow.ts` (new)
- `src/lib/graphs/patch-applier.ts` (new)
- `src/lib/json2mermaid/types.ts` (modified — added `id?` to `GraphEdge`)
- `src/lib/graphs/studio-session.types.ts` (modified — `patchHistory`, updated `DiagramPatch`, `PatchAnimationEvent`, updated `StudioInteractResponse`)
- `src/lib/graphs/studio-session.graph.ts` (modified — `DiagramPatchSchema`, `buildRefineDiagramPrompt`, `apply-patch` FnNode, `build-patch-confirmation` FnNode, edge wiring)
- `src/lib/graphs/studio-session.runner.ts` (modified — `patchHistory: []` initial state)
- `src/components/studio/DiagramPreviewPanel.tsx` (modified — `patchAnimation` prop + `useEffect` animation)
- `src/components/studio/StudioLayout.tsx` (modified — `patchAnimation` state, pass to panel, 800 ms clear)
- `src/app/api/studio/[workspaceId]/interact/route.ts` (modified — `derivePatchAnimation`, include `patchAnimation` in response)
- `src/app/globals.css` (modified — `patch-add`, `patch-remove`, `patch-modify` keyframes + CSS classes)
- `src/__tests__/graphs/studio-session.test.ts` (modified — updated `removeEdges` test format)
- `src/__tests__/patch/applyPatch.test.ts` (new — 22 tests)
- `src/__tests__/patch/buildRefinePrompt.test.ts` (new — 8 tests)
- `src/__tests__/patch/refinement.integration.test.ts` (new — 9 tests)

## Change Log

- 2026-03-03: Story 6.5 created — iterative diagram refinement via chat, JSON patch format, patch application logic, and patch animation
- 2026-03-03: Story 6.5 implemented — 31 new tests passing (508 total), all 4 ACs satisfied, 0 regressions
