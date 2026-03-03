# Story 6.3 — Conversational Onboarding

## Status: review

## Story

**As a** Product Manager,
**I want** the AI to ask me smart, adaptive questions to understand my product idea before generating a diagram,
**so that** the generated flow is relevant and well-structured from the start.

## Acceptance Criteria

1. **Given** a PM provides a brief description (< 50 words)
   **When** the AI processes it
   **Then** it asks 2-3 targeted clarification questions (actors, happy path, key constraints)

2. **Given** a PM provides a detailed description (> 100 words with clear actors and flow)
   **When** the AI processes it
   **Then** it may skip clarification and proceed directly to diagram generation with at most 1 confirmation question

3. **Given** the AI asks a question
   **When** the PM responds
   **Then** the AI acknowledges the response contextually and either asks a follow-up or proceeds to generation

4. **Given** the conversation reaches sufficient context
   **When** the AI generates the diagram
   **Then** it announces "I see the flow forming" and the diagram appears progressively in the preview

## Tasks/Subtasks

- [x] **Task 1: Onboarding LLM prompt** (`src/lib/ai/prompts/onboarding.ts`)
  - [x] `buildOnboardingPrompt(messages, wordCount)` — returns a system + user prompt pair
  - [x] System prompt instructs model to: analyse word count, decide clarification vs direct generation, ask 2-3 targeted questions (actors / happy path / constraints) for brief inputs, ask ≤1 confirmation for detailed inputs
  - [x] Prompt enforces that questions are concise, non-redundant across turns, and contextually acknowledge the previous PM answer

- [x] **Task 2: Onboarding node wired into studio-session graph** (`src/lib/graphs/studio-session.graph.ts`)
  - [x] Add `classify-input-length` FnNode: computes `wordCount` from first user message, stores in state
  - [x] Update `enough-context?` FnNode: factors in `wordCount` (detailed input → lower clarification threshold, i.e. may reach contextScore ≥ 60 after 0-1 follow-up exchanges)
  - [x] Update `multi-persona-respond` LLMNode prompt: inject `wordCount` and `onboardingPhase` into existing prompt so responses follow onboarding rules
  - [x] Add `announce-generation` FnNode: appends "I see the flow forming" message to thread before routing to `generate`

- [x] **Task 3: Progressive diagram reveal** (`src/components/studio/DiagramPreviewPanel.tsx`)
  - [x] Accept `isStreaming?: boolean` prop
  - [x] When `isStreaming=true`, show a shimmer/skeleton overlay on top of the mermaid preview
  - [x] Wire `MermaidPreview` (Story 2.1) into `DiagramPreviewPanel` — replace static placeholder with real Mermaid render when `diagramContent` is provided
  - [x] Animate the transition from placeholder → shimmer → rendered diagram using CSS opacity fade (300 ms)

- [x] **Task 4: Frontend integration** (`src/components/studio/StudioLayout.tsx`)
  - [x] Replace stub 1-second response with real `POST /api/studio/[workspaceId]/interact` call
  - [x] Handle `{ type: 'question'; content: string }` → append assistant message, set `isLoading=false`
  - [x] Handle `{ type: 'diagram'; mermaid: string }` → set `diagramContent` state, set `isStreaming=true` for 600 ms then `false`
  - [x] Handle `{ type: 'complete'; diagramId: string }` → show toast "Diagram saved", update URL or navigate to editor
  - [x] Maintain `sessionToken` in component state across turns (set from first response header or body)

- [x] **Task 5: Tests** (`src/__tests__/graphs/onboarding.test.ts`)
  - [x] Unit: `classify-input-length` correctly sets `wordCount` for short (< 50) and long (> 100) inputs
  - [x] Unit: `enough-context?` routes to `generate` after 0 clarifications for a 120-word input
  - [x] Unit: `enough-context?` requires ≥ 2 exchanges before routing to `generate` for a 20-word input
  - [x] Unit: `announce-generation` inserts the expected announcement message into `messages`
  - [x] Integration: full onboarding happy path — short description → 2 questions → answers → generate → "I see the flow forming" → diagram

## Technical Notes

### Word-Count Classification

| Input length | Expected behaviour                                                    |
| ------------ | --------------------------------------------------------------------- |
| < 50 words   | Ask 2-3 clarification questions (actors, happy path, constraints)     |
| 50-100 words | Ask 1-2 targeted questions; may proceed if actors + flow are explicit |
| > 100 words  | At most 1 confirmation question; proceed to generation                |

`wordCount` is computed once on the **first** user message and stored in `StudioSessionState`. Subsequent messages only update `contextScore`.

### State Shape Extension

Add to `StudioSessionState` (in `studio-session.types.ts`):

```ts
wordCount: number; // word count of first user message
onboardingPhase: 'clarify' | 'confirm' | 'generate'; // current phase
clarificationCount: number; // number of clarification questions asked so far
```

### Onboarding Prompt Rules (system instructions)

The LLM must:

1. Never repeat a question already asked in `messages`
2. Always open its answer by acknowledging the PM's last message in 1 sentence
3. Ask questions in priority order: actors first, then happy path, then constraints
4. When `onboardingPhase === 'confirm'`, produce exactly 1 yes/no confirmation question
5. When `onboardingPhase === 'generate'`, prepend "I see the flow forming" to the reply

### Progressive Diagram Reveal UX

```
[placeholder] → [shimmer overlay] → [MermaidPreview fade-in]
    0 ms              0 ms                   +600 ms
```

- `isStreaming=true` is set the moment `type: 'diagram'` arrives from the API
- After 600 ms, `isStreaming` flips to `false` and the Mermaid diagram fades in fully
- If the diagram fails to parse, `DiagramPreviewPanel` stays in placeholder state and logs a console warning

### API Contract (unchanged from Story 6.2)

`POST /api/studio/[workspaceId]/interact`

```json
// Request
{ "userMessage": "string", "checkpoint": "<RunCheckpoint object>" }

// Response variants (discriminated union)
{ "type": "question", "content": "string", "checkpoint": "<RunCheckpoint>" }
{ "type": "diagram",  "mermaid": "string", "checkpoint": "<RunCheckpoint>" }
{ "type": "complete", "diagramId": "string" }
```

Note: frontend uses `checkpoint` (graph runner checkpoint object), not `sessionToken`.

### Files to Create / Modify

- `src/lib/ai/prompts/onboarding.ts` — new prompt builder
- `src/lib/graphs/studio-session.types.ts` — extend `StudioSessionState` (add `wordCount`, `onboardingPhase`, `clarificationCount`)
- `src/lib/graphs/studio-session.graph.ts` — add `classify-input-length` and `announce-generation` nodes; update `enough-context?` and `multi-persona-respond`
- `src/components/studio/DiagramPreviewPanel.tsx` — wire `MermaidPreview`, add `isStreaming` prop and shimmer overlay
- `src/components/studio/StudioLayout.tsx` — replace stub with real API call; handle all response types
- `src/app/(dashboard)/workspace/[id]/studio/page.tsx` — pass `workspaceId` param to `StudioLayout`
- `src/lib/graphs/studio-session.runner.ts` — initialise new onboarding fields in `startStudioSession`
- `src/__tests__/graphs/onboarding.test.ts` — new test file

### Dependencies

- `MermaidPreview` component from Story 2.1 (`src/components/diagram/MermaidPreview.tsx`)
- `studio-session.graph.ts` and types from Story 6.2
- `POST /api/studio/[workspaceId]/interact` route from Story 6.2
- Existing AI service: `src/lib/ai/service.ts`

## Dev Agent Record

### Implementation Plan

1. Created `src/lib/ai/prompts/onboarding.ts` with:
   - `buildOnboardingPrompt(input)` — produces system + user prompt pair with phase-aware instructions
   - `determineOnboardingPhase(wordCount, contextScore, clarificationCount)` — pure function for phase selection
2. Extended `StudioSessionState` in `studio-session.types.ts` with `wordCount`, `onboardingPhase`, `clarificationCount`
3. Updated `studio-session.graph.ts`:
   - Changed graph start node from `parse-input` to `classify-input-length`
   - Added `classify-input-length` FnNode (computes wordCount on first turn, skips if already set)
   - Added `countWords()` helper (exported for tests)
   - Updated `parse-input` to re-evaluate `onboardingPhase` on each turn
   - Updated `enough-context?` to call `determineOnboardingPhase` and store new phase
   - Added `announce-generation` FnNode (appends "I see the flow forming" to messages)
   - Updated `buildMultiPersonaPrompt` to use `buildOnboardingPrompt` when phase is `clarify` or `confirm`
   - Updated `present-to-user` onAnswer to increment `clarificationCount` and recompute phase
   - Updated edges: `classify-input-length → parse-input`, `enough-context → announce-generation → generate`
4. Updated `studio-session.runner.ts` to initialise new fields in `startStudioSession`
5. Rewrote `DiagramPreviewPanel.tsx` with `isStreaming` prop, shimmer skeleton, and real `MermaidPreview` integration
6. Replaced stub 1-second response in `StudioLayout.tsx` with real fetch to `/api/studio/[workspaceId]/interact`; handles all response discriminants; maintains checkpoint ref across turns
7. Updated `studio/page.tsx` to extract `id` from async params and pass as `workspaceId` prop
8. Created `src/__tests__/graphs/onboarding.test.ts` with 24 tests

### Debug Log

- `longInput` in tests was only 68 words despite appearing long — fixed by extending the string with additional constraint details to reach 115 words

### Completion Notes

All 4 ACs satisfied:

- AC1: `classify-input-length` sets `onboardingPhase: 'clarify'` for brief inputs; `buildOnboardingPrompt` instructs the LLM to ask 2-3 targeted questions in priority order (actors, happy path, constraints)
- AC2: `determineOnboardingPhase(wordCount > 100, score >= 40, ...)` returns `'generate'` immediately; LLM prompt for generate phase is used directly with at most 1 confirmation
- AC3: system prompt mandates contextual acknowledgement opening (1 sentence) before any question; `clarificationCount` prevents redundant question repetition
- AC4: `announce-generation` FnNode appends "I see the flow forming" to the conversation thread before generation; `DiagramPreviewPanel` shows shimmer for 600 ms then fades in the Mermaid diagram

24 new tests pass, 447 total — 0 regressions.

## File List

- `src/lib/ai/prompts/onboarding.ts` (new)
- `src/lib/graphs/studio-session.types.ts` (modified — added `wordCount`, `onboardingPhase`, `clarificationCount`)
- `src/lib/graphs/studio-session.graph.ts` (modified — new nodes, updated prompts and edges)
- `src/lib/graphs/studio-session.runner.ts` (modified — initialised new state fields)
- `src/components/studio/DiagramPreviewPanel.tsx` (modified — MermaidPreview wired, isStreaming shimmer)
- `src/components/studio/StudioLayout.tsx` (modified — real API call, checkpoint management)
- `src/app/(dashboard)/workspace/[id]/studio/page.tsx` (modified — pass workspaceId prop)
- `src/__tests__/graphs/onboarding.test.ts` (new)

## Change Log

- 2026-03-03: Story 6.3 created — conversational onboarding with adaptive clarification, progressive diagram reveal, and real API integration
- 2026-03-03: Story 6.3 implemented — 24 tests passing, all 4 ACs satisfied, 447/447 total tests green
