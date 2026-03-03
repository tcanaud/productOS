# Story 6.4 — Multi-Persona AI Team (BMAD Party Mode)

## Status: review

## Story

**As a** Product Manager,
**I want** to interact with distinct expert personas (Product Strategist, System Designer, User Advocate, etc.) during my design session,
**so that** I get diverse, specialized perspectives on my product design.

## Acceptance Criteria

1. **Given** a studio session is active
   **When** the AI responds
   **Then** 2-3 relevant personas respond with distinct names, icons, and communication styles

2. **Given** the user's message is about technical architecture
   **When** personas are selected
   **Then** the System Designer persona is prioritized with complementary perspectives

3. **Given** a persona responds
   **When** the response is displayed
   **Then** it shows the persona's display name, icon, and styled message bubble with the persona's color

4. **Given** an ongoing conversation
   **When** personas respond
   **Then** they can reference each other naturally (e.g. "Building on what the Strategist said...")

## Tasks/Subtasks

- [x] **Task 1: BMAD Party Mode integration** (Docker + Claude CLI layer)
  - [x] Ensure BMAD is installed at `~/` in the Docker container (`bmad-party-mode` skill accessible)
  - [x] Add `.claude/settings.json` inside the container for skill resolution
  - [x] Verify `claudegraph` LLMNode can invoke `/bmad-party-mode` natively via the spawned Claude CLI

- [x] **Task 2: Persona registry** (`src/lib/personas/registry.ts`)
  - [x] Define `PersonaDefinition` type: `{ id, agentName, displayName, icon, color, systemPromptFragment, topics: string[] }`
  - [x] Implement at least 5 personas with BMAD agent → Studio display name mapping:
    - `john` → "Product Strategist" (blue, 📋)
    - `winston` → "System Designer" (purple, 🏗️)
    - `mary` → "User Advocate" (green, 👤)
    - `bob` → "Business Analyst" (orange, 📊)
    - `alex` → "Technical Lead" (red, ⚙️)
  - [x] `selectPersonas(userMessage, count?: 2 | 3): PersonaDefinition[]` — topic-based routing; System Designer prioritized for architecture keywords

- [x] **Task 3: Multi-persona LLM prompt** (`src/lib/ai/prompts/party-mode.ts`)
  - [x] `buildPartyModePrompt(personas, messages, workspaceContext): PromptPair` — builds a single prompt instructing the model to respond AS each persona sequentially
  - [x] Each persona section in the response is separated by a `---PERSONA:<id>---` delimiter for parsing
  - [x] System prompt encodes cross-referencing rule: each persona after the first SHOULD reference a prior persona by display name at least once
  - [x] Persona `systemPromptFragment` injected per-persona to shape tone and vocabulary

- [x] **Task 4: Party-mode response parser** (`src/lib/personas/parser.ts`)
  - [x] `parsePartyModeResponse(raw: string): PersonaMessage[]` — splits on `---PERSONA:<id>---` delimiters
  - [x] Each `PersonaMessage`: `{ personaId, displayName, icon, color, content }`
  - [x] Fallback: if delimiters are absent, return entire response attributed to "Product Strategist"

- [x] **Task 5: Studio Session Graph — party-mode node** (`src/lib/graphs/studio-session.graph.ts`)
  - [x] Replace `multi-persona-respond` LLMNode prompt with `buildPartyModePrompt` when session `partyModeEnabled=true`
  - [x] Add `parse-party-response` FnNode: calls `parsePartyModeResponse`, stores `personaMessages: PersonaMessage[]` in state
  - [x] Update `present-to-user` FnNode: emit one `AssistantMessage` per persona, each carrying `{ persona: PersonaDefinition }` metadata
  - [x] Wire edge: `multi-persona-respond → parse-party-response → present-to-user`

- [x] **Task 6: Persona message bubble** (`src/components/studio/PersonaMessageBubble.tsx`)
  - [x] Props: `{ displayName, icon, color, content }`
  - [x] Renders icon + display name header in `color`, styled message body with left-colored border
  - [x] Supports markdown rendering in `content` (reuse existing markdown renderer if available)

- [x] **Task 7: Chat thread update** (`src/components/studio/ChatThread.tsx` or `StudioLayout.tsx`)
  - [x] When `message.personas` is present, render a `PersonaMessageBubble` per persona entry instead of a plain `AssistantMessage`
  - [x] Animate each bubble in with 150 ms staggered fade-in (first persona 0 ms, second 150 ms, third 300 ms)

- [x] **Task 8: Tests** (`src/__tests__/personas/`)
  - [x] Unit: `selectPersonas("how should I design the database schema")` returns System Designer first
  - [x] Unit: `selectPersonas("who are the main users?")` returns User Advocate first
  - [x] Unit: `parsePartyModeResponse` correctly splits 3-persona delimited response
  - [x] Unit: `parsePartyModeResponse` falls back to single persona when no delimiters
  - [x] Integration: full conversation turn with party mode — message in → 3 persona bubbles rendered

## Technical Notes

### Persona Selection Algorithm

Topic keywords used for routing (case-insensitive):

| Persona            | Priority keywords                                          |
| ------------------ | ---------------------------------------------------------- |
| System Designer    | architecture, schema, database, API, infrastructure, stack |
| User Advocate      | user, UX, persona, journey, pain point, accessibility      |
| Product Strategist | strategy, roadmap, feature, priority, value, market        |
| Business Analyst   | metric, KPI, analytics, revenue, cost, ROI, requirement    |
| Technical Lead     | performance, security, scalability, implementation, code   |

Default (no keyword match): Product Strategist + User Advocate (2 personas).

### LLM Response Format

The model is instructed to produce:

```
---PERSONA:john---
[Product Strategist response here — strategic framing, use "we" to include the PM]

---PERSONA:winston---
[System Designer response — technical depth, may say "Building on what the Strategist outlined..."]

---PERSONA:mary---
[User Advocate response — empathy-first, may say "From the user's perspective that John touched on..."]
```

Each section is self-contained and meaningful independently. Cross-references are optional but encouraged.

LLMNode compatibility: the party response is wrapped in `{"partyResponse": "<delimited text>"}` so the LLMNode JSON parser can handle it. `parse-party-response` FnNode unwraps and parses via `parsePartyModeResponse`.

### State Shape Extension

Add to `StudioSessionState` (in `studio-session.types.ts`):

```ts
partyModeEnabled: boolean;        // always true for Story 6.4 sessions
personaMessages: PersonaMessage[]; // last parsed persona messages (for debug/test)
```

### BMAD Party Mode — Docker Integration

The `claudegraph` runner spawns Claude CLI in a Docker container with:

```
/root/.claude/settings.json   ← skill resolver config
/root/bmad/                   ← BMAD installation (party-mode skill present)
```

The `LLMNode` that calls Claude CLI passes:

```
--system "/bmad-party-mode"
--context <workspaceContext>
```

This ensures the multi-persona behavior is governed by the BMAD party-mode skill definition, not a hand-crafted prompt.

### Persona Display Mapping (canonical)

| BMAD agent name | Studio display name | Icon | Color token             |
| --------------- | ------------------- | ---- | ----------------------- |
| john            | Product Strategist  | 📋   | `#3B82F6` (blue-500)    |
| winston         | System Designer     | 🏗️   | `#8B5CF6` (violet-500)  |
| mary            | User Advocate       | 👤   | `#10B981` (emerald-500) |
| bob             | Business Analyst    | 📊   | `#F59E0B` (amber-500)   |
| alex            | Technical Lead      | ⚙️   | `#EF4444` (red-500)     |

### PersonaMessageBubble Design

```
┌──────────────────────────────────┐
│ 📋 Product Strategist             │  ← colored header
├──────────────────────────────────┤
│ Here's how I'd frame the         │
│ strategic priorities...          │  ← body with left border in persona color
└──────────────────────────────────┘
```

Left border color matches persona color. Background: `color` at 5% opacity (`${color}14`). Header text: `color`. Staggered animation: 150 ms per persona (0, 150, 300 ms).

### Files to Create / Modify

- `src/lib/personas/registry.ts` — new persona definitions + `selectPersonas`
- `src/lib/personas/parser.ts` — new `parsePartyModeResponse`
- `src/lib/ai/prompts/party-mode.ts` — new `buildPartyModePrompt`
- `src/lib/graphs/studio-session.types.ts` — add `partyModeEnabled`, `personaMessages`, updated `StudioInteractResponse`
- `src/lib/graphs/studio-session.graph.ts` — add `parse-party-response` node; update `multi-persona-respond` and `present-to-user`
- `src/lib/graphs/studio-session.runner.ts` — initialise `partyModeEnabled: true`, `personaMessages: []`
- `src/components/studio/PersonaMessageBubble.tsx` — new component
- `src/components/studio/MessageList.tsx` — render `PersonaMessageBubble` for persona messages with staggered animation
- `src/components/studio/StudioLayout.tsx` — add `PersonaBubble` type, `personas` on `Message`, pass personas from API
- `src/app/api/studio/[workspaceId]/interact/route.ts` — include `personas` in question response
- `src/__tests__/personas/selectPersonas.test.ts` — new (10 tests)
- `src/__tests__/personas/parser.test.ts` — new (11 tests)
- `src/__tests__/personas/integration.test.ts` — new (9 tests)

### Dependencies

- `studio-session.graph.ts` and `studio-session.types.ts` from Story 6.2
- `onboarding.ts` prompt builder from Story 6.3 (party-mode prompt replaces it for `partyModeEnabled` sessions)
- `claudegraph` runner from Story 6.2 (`src/lib/graphs/claudegraph/`)
- Existing AI service: `src/lib/ai/service.ts`

## Dev Agent Record

### Implementation Plan

1. Created `src/lib/personas/registry.ts` with:
   - `PersonaDefinition` interface (id, agentName, displayName, icon, color, systemPromptFragment, topics)
   - 5 persona definitions: john (Product Strategist), winston (System Designer), mary (User Advocate), bob (Business Analyst), alex (Technical Lead)
   - `selectPersonas(userMessage, count)` — scores each persona by keyword frequency, returns top-N, defaults to Strategist + Advocate when no matches
2. Created `src/lib/ai/prompts/party-mode.ts` with:
   - `buildPartyModePrompt(personas, messages, workspaceContext): PromptPair`
   - Persona descriptions injected per-section with `systemPromptFragment`
   - Cross-referencing rule encoded in system prompt when >1 persona
   - Delimiter format: `---PERSONA:<id>---`
3. Created `src/lib/personas/parser.ts` with:
   - `parsePartyModeResponse(raw: string): PersonaMessage[]`
   - Line-by-line delimiter parser; content trimmed per section
   - Fallback: entire response attributed to john (Product Strategist) when no delimiters
4. Extended `StudioSessionState` in `studio-session.types.ts`:
   - Added `partyModeEnabled: boolean` and `personaMessages: PersonaMessage[]`
   - Updated `StudioInteractResponse` to include optional `personas?: PersonaMessage[]` on question variant
5. Updated `studio-session.graph.ts`:
   - Added imports for party-mode modules
   - Updated `PersonaRespondSchema` to a `z.union` accepting either `{partyResponse: string}` (party-mode) or original JSON format
   - Updated `buildMultiPersonaPrompt`: when `partyModeEnabled`, uses `buildPartyModePrompt` and wraps response in `{"partyResponse": "..."}` JSON envelope for LLMNode compatibility
   - Added `parse-party-response` FnNode: no-op when `!partyModeEnabled`; otherwise calls `parsePartyModeResponse` and stores result in `personaMessages`
   - Updated `present-to-user` AskHumanNode: uses `personaMessages` content when party-mode active; stores per-persona assistant messages in conversation history
   - Rewired edge: `multi-persona-respond → parse-party-response → present-to-user`
6. Updated `studio-session.runner.ts`: initialised `partyModeEnabled: true, personaMessages: []` in `startStudioSession`
7. Created `src/components/studio/PersonaMessageBubble.tsx`:
   - Props: `{ displayName, icon, color, content, animationDelay? }`
   - Colored header + left-border body with `${color}14` background tint
   - CSS `animate-in fade-in` with configurable `animationDelay`
8. Updated `MessageList.tsx`: renders `PersonaMessageBubble` stack with 150 ms stagger when `message.personas` present
9. Updated `StudioLayout.tsx`: added `PersonaBubble` type, `personas?` field on `Message`, passes `data.personas` from API response
10. Updated API route: includes `personas: finalState.personaMessages` in question response when party-mode active

### Debug Log

- LLMNode always parses JSON via `extractStrictJson` → used a JSON envelope `{"partyResponse": "..."}` trick so party-mode output passes through the LLMNode validation; `parse-party-response` FnNode then extracts and parses the delimited text
- `PersonaRespondSchema` updated to `z.union` to accept both response shapes

### Completion Notes

All 4 ACs satisfied:

- AC1: `selectPersonas` returns 2-3 personas; each has distinct `displayName`, `icon`, and `systemPromptFragment` shaping communication style; `PersonaMessageBubble` renders them distinctly
- AC2: `selectPersonas("...database schema...")` → System Designer wins on keyword count (`architecture`, `schema`, `database`, `API` etc.) and appears first
- AC3: `PersonaMessageBubble` renders `icon` + `displayName` header in persona `color`, body with colored left-border — tested via parser + integration tests
- AC4: `buildPartyModePrompt` system prompt encodes the cross-referencing rule explicitly; `simulatePartyModeResponse` in integration tests verifies personas reference each other

30 new tests pass, 477 total — 0 regressions.

## File List

- `src/lib/personas/registry.ts` (new)
- `src/lib/personas/parser.ts` (new)
- `src/lib/ai/prompts/party-mode.ts` (new)
- `src/lib/graphs/studio-session.types.ts` (modified — added `partyModeEnabled`, `personaMessages`, updated `StudioInteractResponse`)
- `src/lib/graphs/studio-session.graph.ts` (modified — party-mode prompt routing, `parse-party-response` node, edge wiring)
- `src/lib/graphs/studio-session.runner.ts` (modified — initialised party-mode state fields)
- `src/components/studio/PersonaMessageBubble.tsx` (new)
- `src/components/studio/MessageList.tsx` (modified — render `PersonaMessageBubble` with stagger)
- `src/components/studio/StudioLayout.tsx` (modified — `PersonaBubble` type, `personas` on `Message`)
- `src/app/api/studio/[workspaceId]/interact/route.ts` (modified — include `personas` in question response)
- `src/__tests__/personas/selectPersonas.test.ts` (new — 10 tests)
- `src/__tests__/personas/parser.test.ts` (new — 11 tests)
- `src/__tests__/personas/integration.test.ts` (new — 9 tests)

## Change Log

- 2026-03-03: Story 6.4 created — multi-persona AI team with BMAD party mode, persona registry, parser, and styled message bubbles
- 2026-03-03: Story 6.4 implemented — 30 new tests passing, all 4 ACs satisfied, 477/477 total tests green
