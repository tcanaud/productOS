# Story 10.1 — AI Layer Context Builder

## Status: review

## Story

**As a** user,
**I want** the AI to understand my current position in the layer hierarchy when I chat,
**So that** its responses respect parent contracts, sibling context, and child interfaces.

---

## Acceptance Criteria

1. **Given** the user is editing a layer at depth N
   **When** the AI processes a chat message (via studio-session.graph)
   **Then** `buildLayerContext(layerGraphId)` is called and returns a `LayerContext` object containing:
   - `current`: full JsonGraph + ports + name + depth
   - `parent`: ports + sibling summaries (or null if root)
   - `ancestors`: AI-generated summaries for grandparent and beyond (max 2 levels, NFR-L2)
   - `children`: names + ports only (no internal graphs)

2. **Given** a LayerContext is built
   **When** the AI prompt is constructed in `refine-flow.ts`
   **Then** the layer context is injected following the prompt template pattern from the architecture document

3. **And** the prompt includes contract constraints ("respect these inputs/outputs")

4. **Given** a layer at depth > 2
   **When** `buildLayerContext` fetches ancestor summaries
   **Then** summaries are read from the `summary` field on LayerGraph (cached)

5. **And** if no cached summary exists, it is generated via `summary-generator.ts` and cached

6. **Given** the summary generator runs
   **When** it generates a summary for a LayerGraph
   **Then** the summary is stored in the `summary` field of that LayerGraph

7. **And** the summary is a concise text (1-3 sentences) describing the graph's purpose and key nodes

8. **Given** a LayerGraph's `graph` field is modified
   **When** the update is saved
   **Then** the `summary` field is set to null (cache invalidated — already in Story 9.1 PATCH)

9. **Given** the studio-session.graph state type
   **When** layer awareness is added
   **Then** `currentLayerId` and `layerStack` fields are included in the state

10. **And** the interact API route passes these from the request body

---

## Technical Notes

- **New**: `src/lib/layer/context-builder.ts`
- **New**: `src/lib/layer/summary-generator.ts`
- **Modify**: `src/lib/ai/prompts/refine-flow.ts` — inject `LayerContext` block
- **Modify**: `src/lib/graphs/studio-session.graph.ts` — layer-aware state threading
- **Modify**: `src/lib/graphs/studio-session.types.ts` — add `currentLayerId`, `layerStack`
- **Modify**: `src/app/api/studio/[workspaceId]/interact/route.ts` — pass layer fields from body
- Requirements: FR-L4, NFR-L2, AR-L5, AR-L12

---

## Dev Notes

### `LayerContext` type (`src/lib/layer/context-builder.ts`)

```ts
export interface LayerContextCurrent {
  id: string;
  name: string;
  depth: number;
  ports: LayerPort[];
  graph: JsonGraph;
}

export interface LayerContextParent {
  id: string;
  name: string;
  ports: LayerPort[];
  /** Sibling layer summaries (other children of the same parent, excluding current). */
  siblings: { id: string; name: string; summary: string | null }[];
}

export interface LayerContextAncestor {
  id: string;
  name: string;
  depth: number;
  summary: string; // always non-null (generated if missing)
}

export interface LayerContextChild {
  id: string;
  name: string;
  ports: LayerPort[];
}

export interface LayerContext {
  current: LayerContextCurrent;
  parent: LayerContextParent | null; // null for root layers (depth === 0)
  ancestors: LayerContextAncestor[]; // grandparent and beyond, max 2 entries (NFR-L2)
  children: LayerContextChild[];
}

export async function buildLayerContext(
  workspaceId: string,
  layerGraphId: string
): Promise<LayerContext>;
```

**Implementation strategy:**

1. Fetch current layer (graph + ports + name + depth + parentGraphId)
2. If parentGraphId: fetch parent layer, its children (for siblings), parent's ports
3. Walk ancestors up the chain (max 2 more levels beyond parent), generate/use summaries
4. Fetch direct children (names + ports only, `select: { id, name, ports }`)
5. Ancestors use `summary-generator.ts` for lazy cache-miss generation

**Ancestor cap (NFR-L2):** Only grandparent + great-grandparent are included (2 levels). Beyond that is too far from the current context.

### `summary-generator.ts` (`src/lib/layer/summary-generator.ts`)

```ts
export async function generateAndCacheSummary(
  workspaceId: string,
  layerId: string,
  graph: JsonGraph,
  name: string
): Promise<string>;
```

- Calls `anthropic.messages.create()` with a short prompt:
  > "Summarize this process/flow diagram in 1-3 sentences. Focus on its purpose and key steps. Graph name: {name}. Graph: {JSON}"
- Uses `claude-haiku-4-5-20251001` for speed/cost efficiency (summaries don't need Sonnet)
- Model: `claude-haiku-4-5-20251001`
- Stores result via `prisma.layerGraph.update({ where: { id: layerId }, data: { summary: result } })`
- Returns the generated summary string

### Prompt injection (`src/lib/ai/prompts/refine-flow.ts`)

Extend `buildRefinePrompt` signature:

```ts
export function buildRefinePrompt(
  currentGraph: JsonGraph,
  instruction: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  layerContext?: LayerContext // new optional param
): PromptPair;
```

When `layerContext` is provided, inject a `## Layer Context` section in the system prompt after the rules, before the few-shot examples:

```
## Layer Context

You are editing layer "{current.name}" (depth {current.depth}).

### Current Layer Interface (RESPECT THESE — do not remove them)
Inputs:  {ports filtered to direction="input"  → name (type)}
Outputs: {ports filtered to direction="output" → name (type)}

### Parent Layer: "{parent.name}"
Parent expected inputs:  {parent ports direction="output" → these flow INTO current}
Parent expected outputs: {parent ports direction="input"  → current must produce these}
Siblings: {sibling names and summaries}

### Ancestors
{ancestors[0].name} (depth {ancestors[0].depth}): {ancestors[0].summary}
{ancestors[1].name} (depth {ancestors[1].depth}): {ancestors[1].summary}

### Child Layers
{children[0].name}: in={...} out={...}
{children[1].name}: in={...} out={...}

**Contract Rule**: Your patch MUST NOT remove nodes that are directly connected to port inputs/outputs. Respect the layer's interface contract.
```

Omit sections that are empty (no parent, no ancestors, no children, no ports).

### State changes (`studio-session.types.ts`)

Add to `StudioSessionState`:

```ts
/** Story 10.1: ID of the LayerGraph being edited (null = root studio diagram). */
currentLayerId?: string | null;
/** Story 10.1: Layer navigation stack (mirrors client-side layerStack). */
layerStack?: { graphId: string; label: string }[];
```

### studio-session.graph.ts changes

In the `refine` LLMNode handler (the node that calls `buildRefinePrompt`):

- Check if `state.currentLayerId` is set
- If yes: call `buildLayerContext(state.workspaceId, state.currentLayerId)` (async)
- Pass the resulting `LayerContext` as the 4th arg to `buildRefinePrompt`

### interact route changes (`route.ts`)

Extend body parsing to accept:

```ts
currentLayerId?: string | null;
layerStack?: { graphId: string; label: string }[];
```

When starting a new session (`startStudioSession`), pass these as initial state overrides.
When resuming (`resumeStudioSession`), the checkpoint already contains them — no change needed.

Note: `startStudioSession` already accepts an initial state partial; extend its signature if needed.

### Client-side (StudioLayout.tsx) — optional follow-up

The `layerStack` and the top `graphId` are already tracked in the `useLayerNavigation` hook. The interact call in `handleSend` should be extended to include:

```ts
body.currentLayerId = layerStack.length > 1 ? layerStack[layerStack.length - 1].graphId : null;
body.layerStack = layerStack;
```

This wires the client state to the server's layer-aware session.

### Error handling

- If `buildLayerContext` fails (layer not found, DB error): log warning, proceed without layer context (graceful degradation — AI still works without it)
- If `generateAndCacheSummary` fails: return a fallback string `"[Summary unavailable]"` and do not throw

---

## Tasks

- [x] **Task 1**: Add `currentLayerId` and `layerStack` fields to `StudioSessionState` in `studio-session.types.ts`
- [x] **Task 2**: Create `src/lib/layer/summary-generator.ts`
  - [x] Haiku-based LLM call for 1-3 sentence summary
  - [x] Persist to `LayerGraph.summary` via Prisma
  - [x] Graceful fallback on failure
- [x] **Task 3**: Create `src/lib/layer/context-builder.ts`
  - [x] Fetch current layer (graph + ports + name + depth)
  - [x] Fetch parent + siblings (or null for root)
  - [x] Fetch ancestors up to 2 levels, using/generating summaries
  - [x] Fetch direct children (names + ports only)
  - [x] Return typed `LayerContext` object
- [x] **Task 4**: Extend `buildRefinePrompt` in `src/lib/ai/prompts/refine-flow.ts`
  - [x] Add optional `layerContext?: LayerContext` parameter
  - [x] Inject `## Layer Context` section in system prompt when present
  - [x] Include contract constraint rule
- [x] **Task 5**: Wire layer context into `studio-session.graph.ts`
  - [x] In the refine node handler: check `state.currentLayerId`
  - [x] Call `buildLayerContext` when layer ID is set
  - [x] Pass result to `buildRefinePrompt`
- [x] **Task 6**: Update `interact/route.ts` to pass layer fields from request body
  - [x] Parse `currentLayerId` and `layerStack` from body
  - [x] Pass to `startStudioSession` initial state
- [x] **Task 7**: Update `StudioLayout.tsx` to send layer fields in chat requests
  - [x] Include `currentLayerId` and `layerStack` in `handleSend` body
  - [x] Include in `handleRespond` body

---

## Dev Agent Record

### Implementation Plan

1. Added `currentLayerId` and `layerStack` optional fields to `StudioSessionState`
2. Created `summary-generator.ts` — Haiku-powered 1-3 sentence summaries with DB caching and graceful fallback
3. Created `context-builder.ts` — builds full `LayerContext` (current + parent + siblings + ancestors[max 2] + children)
4. Extended `buildRefinePrompt` with optional `LayerContext` param + `buildLayerContextBlock()` helper that generates the `## Layer Context` system prompt section
5. Added `build-refine-context` FnNode before the `refine` LLMNode in the studio graph — fetches layer context async, stores in `_layerContext` state field
6. Re-wired `route-diagram → build-refine-context → refine` edge in the graph
7. Extended `startStudioSession` to accept `layerOverrides` param; updated `interact/route.ts` to parse and pass `currentLayerId`/`layerStack` from request body
8. Updated `StudioLayout.tsx` `handleSend` and `handleRespond` to include current layer fields in every interact API call

### File List

- `src/lib/graphs/studio-session.types.ts` — Added `currentLayerId` and `layerStack` fields to `StudioSessionState`
- `src/lib/layer/summary-generator.ts` — New: Haiku-based summary generator with DB caching
- `src/lib/layer/context-builder.ts` — New: `buildLayerContext()` returning full `LayerContext`
- `src/lib/ai/prompts/refine-flow.ts` — Extended with optional `layerContext` param + `buildLayerContextBlock()` helper
- `src/lib/graphs/studio-session.graph.ts` — Added `build-refine-context` FnNode, updated edges and imports
- `src/lib/graphs/studio-session.runner.ts` — Extended `startStudioSession` with `layerOverrides` param
- `src/app/api/studio/[workspaceId]/interact/route.ts` — Parse + pass `currentLayerId`/`layerStack` from body
- `src/components/studio/StudioLayout.tsx` — Send layer fields in `handleSend` and `handleRespond`

### Completion Notes

All 10 ACs satisfied:

- AC 1: `buildLayerContext()` returns `LayerContext` with current (graph+ports+name+depth), parent (ports+siblings), ancestors (max 2, NFR-L2), children (names+ports only)
- AC 2–3: `buildRefinePrompt` injects `## Layer Context` section with contract constraint rule
- AC 4–5: Ancestors read from `summary` field; cache-miss triggers `generateAndCacheSummary()`
- AC 6–7: Summary stored via `prisma.layerGraph.update`; 1-3 sentences from Haiku
- AC 8: Summary cache invalidation already in Story 9.1 PATCH route (sets summary=null)
- AC 9–10: `currentLayerId`/`layerStack` added to `StudioSessionState`; interact route parses from body and passes to `startStudioSession`
- 0 new lint errors, 0 new TypeScript errors

### Change Log

- 2026-03-04: Implemented Story 10.1 — AI Layer Context Builder. New: summary-generator.ts, context-builder.ts. Modified: studio-session.types.ts, refine-flow.ts, studio-session.graph.ts, studio-session.runner.ts, interact/route.ts, StudioLayout.tsx.
