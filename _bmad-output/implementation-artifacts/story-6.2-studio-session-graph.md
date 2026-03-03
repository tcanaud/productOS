# Story 6.2 — Studio Session Graph (claudegraph)

## Status: review

## Story

**As a** Developer,
**I want** a claudegraph `studio-session.graph` that orchestrates the entire design conversation with InteractionNodes for user dialogue,
**so that** the AI conversation flow is structured, testable, and maintainable.

## Acceptance Criteria

1. **Given** a studio session starts
   **When** the graph is initialized
   **Then** it enters the `parse-user-input` node and routes based on context analysis

2. **Given** the graph reaches an InteractionNode
   **When** it needs user input
   **Then** the graph pauses execution, emits the question/prompt to the frontend, and waits for the user's response before continuing

3. **Given** the graph determines sufficient context exists
   **When** the `enough-context?` FnNode evaluates
   **Then** it routes to the `generate` LLMNode to produce a diagram

4. **Given** the user sends a refinement instruction
   **When** the graph routes to the `refine` LLMNode
   **Then** it produces a JSON patch (`addNodes`, `removeNodes`, `addEdges`, `removeEdges`, `modifyNodes`) instead of a full regeneration

5. **Given** the user validates the diagram
   **When** they confirm
   **Then** the graph routes to `persist` and terminates gracefully

## Tasks/Subtasks

- [x] **Task 1: Types file** (`src/lib/graphs/studio-session.types.ts`)
  - [x] Define `StudioSessionState` interface
  - [x] Define `DiagramPatch` interface

- [x] **Task 2: Graph definition** (`src/lib/graphs/studio-session.graph.ts`)
  - [x] Implement `parse-input` FnNode (intent classification)
  - [x] Implement `select-personas` FnNode
  - [x] Implement `multi-persona-respond` LLMNode (Zod schema, prompt)
  - [x] Implement `present-to-user` AskHumanNode (InteractionNode)
  - [x] Implement `route` FnNode
  - [x] Implement `enough-context?` FnNode (contextScore threshold)
  - [x] Implement `generate` LLMNode (JsonGraph schema)
  - [x] Implement `present-diagram-to-user` AskHumanNode
  - [x] Implement `route-diagram` FnNode
  - [x] Implement `refine` LLMNode (DiagramPatch schema)
  - [x] Implement `persist` FnNode
  - [x] Wire all edges

- [x] **Task 3: Runner** (`src/lib/graphs/studio-session.runner.ts`)
  - [x] `createStudioSessionRunner(workspaceId)` factory
  - [x] `startSession(userMessage)` → calls `runner.run()`
  - [x] `resumeSession(checkpoint, userMessage)` → calls `runner.resume()`

- [x] **Task 4: API route** (`src/app/api/studio/[workspaceId]/interact/route.ts`)
  - [x] `POST` handler
  - [x] Parse body `{ userMessage, sessionToken }`
  - [x] Route to startSession / resumeSession
  - [x] Return JSON response with type discriminant

- [x] **Task 5: Tests** (`src/__tests__/graphs/studio-session.test.ts`)
  - [x] Unit test: parse-input node classifies intents correctly
  - [x] Unit test: enough-context? routes correctly based on contextScore
  - [x] Unit test: route-diagram classifies confirm/refine/discard
  - [x] Integration: happy path (describe → generate → confirm → persist)
  - [x] Integration: refine path (describe → generate → refine → generate → confirm)

## Technical Notes

### Graph Flow

```
[parse-input]
  → [select-personas]
  → [multi-persona-respond] (LLMNode)
  → [present-to-user] (InteractionNode)
  → [route]
  → loop back to [parse-input]  OR  [enough-context?]
       ↓ yes
     [generate] (LLMNode)
       → [present-diagram-to-user] (InteractionNode)
       → [route-diagram]
           → [refine] (LLMNode)  → loop
           → [persist]           → END
```

### Node Definitions

| Node ID                   | Type         | Responsibility                                                                           |
| ------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `parse-input`             | FnNode       | Parse raw user message; classify intent (describe / refine / confirm / other)            |
| `select-personas`         | FnNode       | Pick active AI personas (Optimist / Moderate / Critic) based on session config           |
| `multi-persona-respond`   | LLMNode      | Fan-out: generate one response per persona in parallel; merge into thread                |
| `present-to-user`         | AskHumanNode | Pause graph; emit merged response + follow-up question to frontend                       |
| `route`                   | FnNode       | Evaluate conversation state; route to `parse-input` (loop) or `enough-context?`          |
| `enough-context?`         | FnNode       | Decide if gathered context is sufficient to generate a diagram (bool)                    |
| `generate`                | LLMNode      | Generate full JsonGraph from session context using `json2mermaid` schema                 |
| `present-diagram-to-user` | AskHumanNode | Pause graph; stream diagram preview to frontend; await user confirmation                 |
| `route-diagram`           | FnNode       | Classify user response as refine / confirm / discard                                     |
| `refine`                  | LLMNode      | Produce JSON patch: `{ addNodes?, removeNodes?, addEdges?, removeEdges?, modifyNodes? }` |
| `persist`                 | FnNode       | Apply final diagram to Prisma `Diagram` model; mark session complete; END                |

### claudegraph Integration

- Graph file: `src/lib/graphs/studio-session.graph.ts`
- "InteractionNode" = claudegraph `AskHumanNode` (the native pause/resume node)
- `GraphRunner` is instantiated per studio session and its checkpoint is serialized between interactions
- Session state shape (passed through graph context):

```ts
interface StudioSessionState {
  workspaceId: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  personaResponses: Record<string, string>; // personaId → response text
  currentDiagram: JsonGraph | null;
  intent: 'describe' | 'refine' | 'confirm' | 'other' | null;
  contextScore: number; // 0–100; threshold for enough-context? is 60
}
```

### LLMNode Prompts

- `multi-persona-respond`: use existing `aiService.reviewDiagram()` persona logic as reference (Story 3.1)
- `generate`: reuse `aiService.generateFlow()` prompt structure (Story 2.2)
- `refine`: system prompt instructs model to output **only** a JSON patch object, never a full diagram

### JSON Patch Schema (refine node output)

```ts
interface DiagramPatch {
  addNodes?: { id: string; label: string; type?: string }[];
  removeNodes?: string[]; // node IDs
  addEdges?: { from: string; to: string; label?: string }[];
  removeEdges?: { from: string; to: string }[];
  modifyNodes?: { id: string; label?: string; type?: string }[];
}
```

### API Route

- `POST /api/studio/[workspaceId]/interact`
- Body: `{ userMessage: string; sessionToken: string }`
- Response (streaming or JSON):
  - While graph is paused at InteractionNode: `{ type: 'question'; content: string }`
  - When diagram is ready: `{ type: 'diagram'; mermaid: string; patch?: DiagramPatch }`
  - On persist: `{ type: 'complete'; diagramId: string }`

### Files to Create / Modify

- `src/lib/graphs/studio-session.graph.ts` — graph definition
- `src/lib/graphs/studio-session.types.ts` — `StudioSessionState`, `DiagramPatch` types
- `src/lib/graphs/studio-session.runner.ts` — `GraphRunner` wrapper; handles session state serialization
- `src/app/api/studio/[workspaceId]/interact/route.ts` — API route
- `src/__tests__/graphs/studio-session.test.ts` — unit tests per node (mock LLM calls)

### Testing Strategy

- Each FnNode tested in isolation with mock state
- LLMNodes tested with `vi.mock` on `aiService`
- InteractionNode pause/resume tested via `GraphRunner` mock
- Integration test: full happy path from `parse-input` → `persist`

### Dependencies

- claudegraph (already installed, see Story 6.1 technical notes)
- Existing AI service: `src/lib/ai/service.ts` (Stories 2.0–3.1)
- Existing types: `JsonGraph` from `src/lib/json2mermaid/`
- Prisma `Diagram` model (Story 2.1)

## Dev Agent Record

### Implementation Plan

1. Created types file (`studio-session.types.ts`) with `StudioSessionState`, `DiagramPatch`, and `StudioInteractResponse` types
2. Created graph definition (`studio-session.graph.ts`) using `FnNode` for pure logic, `LLMNode` for AI calls, and `AskHumanNode` as "InteractionNode"
3. Created runner wrapper (`studio-session.runner.ts`) with `InMemoryRunStore` for checkpoint persistence between HTTP requests
4. Created API route with discriminated response types (question / diagram / complete / error)
5. Created 31 unit tests covering intent classification, context scoring, patch application, and routing logic

### Debug Log

- Fixed `onAnswer` return type: claudegraph requires `{ next: string; statePatch?: State }` — `next` is mandatory.
- Fixed `z.record(z.string())` → `z.record(z.string(), z.string())` for Zod v4 compatibility.
- Tuned `computeContextScore` scoring formula to produce ≥60 for 3+ substantive user messages (threshold was too high with initial formula).
- Fixed `nodes`/`edges` type narrowing in `convert-diagram` FnNode using explicit `.map()` to avoid `string` not assignable to `NodeShape | EdgeType` errors.

### Completion Notes

All 5 ACs satisfied:

- AC1: `parse-input` is the graph start node, immediately classifies intent and contextScore
- AC2: `present-to-user` and `present-diagram-to-user` are `AskHumanNode`s using claudegraph's native pause/resume
- AC3: `enough-context` FnNode routes to `generate` when `contextScore >= 60`
- AC4: `refine` LLMNode produces `DiagramPatch`; `apply-patch` FnNode applies it via `applyDiagramPatch`
- AC5: `route-diagram` routes to `persist` on `confirm` intent; `persist` uses `kind: 'end'`

31 tests pass, 0 regressions in full suite.

## File List

- `src/lib/graphs/studio-session.types.ts` (new)
- `src/lib/graphs/studio-session.graph.ts` (new)
- `src/lib/graphs/studio-session.runner.ts` (new)
- `src/app/api/studio/[workspaceId]/interact/route.ts` (new)
- `src/__tests__/graphs/studio-session.test.ts` (new)

## Change Log

- 2026-03-03: Story 6.2 implemented — studio session graph with AskHumanNode interaction nodes, full multi-turn flow, API route, 31 tests passing
