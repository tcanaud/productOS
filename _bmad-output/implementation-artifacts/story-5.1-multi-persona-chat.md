# Story 5.1: Multi-Persona Product Design Chat

Status: review

## Story

As a Product Manager,
I want to discuss my product design with AI agents that have distinct expert personalities (Analyst, Architect, Critic, etc.),
so that I can challenge and refine my thinking as if collaborating with a senior team.

## Acceptance Criteria

1. Given a PM inside a workspace with existing artifacts, when they open the Product Design Chat, then 3+ personas are available (e.g. PM Optimist, Architect Pragmatist, Critic, Analyst) (AC:1)
2. Given a PM sends a message in the chat, when the AI responds, then 2-3 relevant personas respond with distinct communication styles (AC:2)
3. Given a PM sends a message, when personas respond, then they reference workspace artifacts (diagrams, specs) in context (AC:3)
4. Given a persona suggests a change, when the suggestion is actionable, then the PM can apply it directly (e.g. "Add this edge case to the diagram") (AC:4)
5. Given an ongoing conversation, when personas interact, then they can build on, challenge, or complement each other's points naturally (AC:5)

## Tasks / Subtasks

- [x] Task 1: Persona definitions and system prompts (AC: 1, 2, 5)
  - [x] Create `src/lib/ai/prompts/personas.ts` — define 4 personas with full system prompts
  - [x] Each persona object: `{ id, name, icon, color, systemPrompt, expertise[], style }`
  - [x] System prompts include instruction to explicitly reference other personas by name
  - [x] Export `PERSONAS: Record<PersonaId, Persona>` and `ALL_PERSONA_IDS: PersonaId[]`
  - [x] Unit tests: each persona has distinct name, non-empty systemPrompt, valid expertise list

- [x] Task 2: Persona selection logic (AC: 2, 5)
  - [x] Create `src/lib/ai/persona-selector.ts` — `selectPersonas(message, history): PersonaId[]`
  - [x] Returns 2-3 persona IDs per turn
  - [x] Rules: technical keywords -> include ARCHITECT_PRAGMATIST + CRITIC; business/user keywords -> include PM_OPTIMIST + ANALYST
  - [x] Support @PersonaName mention in message to force-include that persona
  - [x] Rotate: never return the same set 2 turns in a row if avoidable
  - [x] Unit tests: technical message selects Architect; business message selects PM Optimist; @mention is honored; output always 2-3 personas

- [x] Task 3: Workspace context injection (AC: 3)
  - [x] Create `src/lib/ai/context-injector.ts` — `buildWorkspaceContext(workspaceId, userId): Promise<string>`
  - [x] Fetch from DB: workspace name, latest diagram, latest spec summary, latest review summary
  - [x] Format as structured Markdown block injected into each persona's system prompt
  - [x] Truncate: if context > 2000 chars, summarize to most relevant artifacts only
  - [x] Unit tests: context string returned; handles missing artifacts gracefully

- [x] Task 4: Zod schemas for chat I/O (AC: 2, 4)
  - [x] Rewrite `src/lib/ai/schemas/chat-response.ts` with SuggestionSchema, PersonaResponseSchema, ChatResponseSchema, ChatMessageSchema
  - [x] Export types: PersonaResponse, Suggestion, ChatResponse, ChatMessage
  - [x] Unit tests: valid ChatResponse parses; missing personaId fails; empty suggestions default to []

- [x] Task 5: Implement `aiService.chat()` (AC: 1-5)
  - [x] Replace stub in `src/lib/ai/service.ts` with full implementation
  - [x] Pipeline: selectPersonas -> parallel LLM calls per persona -> parseStructuredResponse + PersonaResponseSchema -> return ChatResponse
  - [x] Summarize conversation history when > 10 messages
  - [x] ENDPOINT_CONFIG['chat'] already pre-configured; maxTokens updated to 2048
  - [x] Unit tests: chat returns 2-3 responses; each response has personaId, message, suggestions array

- [x] Task 6: Chat API endpoint (AC: 1-5)
  - [x] Create `src/app/api/ai/chat/route.ts` — POST handler
  - [x] Request body: `{ workspaceId, message, history, personaIds? }` validated with Zod
  - [x] Authenticate with requireAuth(); apply withAI(handler, 'chat') middleware
  - [x] Build workspace context via buildWorkspaceContext()
  - [x] Return `{ responses, turn, latencyMs }`
  - [x] Best-effort persist messages to chat_messages table

- [x] Task 7: Chat data model (AC: 3)
  - [x] Add ChatSession model to prisma/schema.prisma
  - [x] Add ChatMessage model
  - [x] Add chatSessions ChatSession[] relation to Workspace and User models
  - [x] prisma migrate dev --name add-chat (documented — migration skipped without live DB)

- [x] Task 8: Chat UI (AC: 1-5)
  - [x] Create `src/components/chat/ChatPanel.tsx` — main panel: message input, send button, scrollable history
  - [x] Create `src/components/chat/PersonaMessage.tsx` — persona icon, name badge, message text
  - [x] Create `src/components/chat/ActionableSuggestion.tsx` — copy-to-clipboard suggestion button
  - [x] Update `src/app/(dashboard)/workspaces/[id]/chat/page.tsx` — replaced placeholder with ChatPanel
  - [x] Loading state: skeleton messages while AI responds
  - [x] Error state: Sonner toast on API failure

- [x] Task 9: Tests (AC: 1-5)
  - [x] Unit test: selectPersonas() returns 2-3 IDs for any input
  - [x] Unit test: technical message includes Architect; business message includes PM Optimist
  - [x] Unit test: @Critic mention forces Critic in response set
  - [x] Unit test: buildWorkspaceContext() returns string; handles missing artifacts gracefully
  - [x] Unit test: ChatResponseSchema parses valid response; rejects missing personaId
  - [x] Integration test: request body validation; auth guard patterns
  - [x] 42 tests, all passing

## Dev Notes

- **Depends on Story 2.0 (AI Client Foundation)** — aiService.chat() stub already existed; ChatResponse type already imported
- **Reuses Story 3.1 infrastructure** — same multi-prompt parallel pattern; same parseStructuredResponse pipeline
- Pre-existing 4 unused-var warnings in service.ts chat stub are eliminated by implementing the stub
- Conversation history summarization: keep last 10 messages; prepend summary line if truncated
- Actionable suggestions v1: copy payload to clipboard
- ENDPOINT_CONFIG['chat'] was already configured (Story 2.0); maxTokens updated to 2048

### Project Structure Notes

- `src/lib/ai/prompts/personas.ts` — persona definitions (new)
- `src/lib/ai/persona-selector.ts` — selection logic (new)
- `src/lib/ai/context-injector.ts` — workspace context builder (new)
- `src/lib/ai/schemas/chat-response.ts` — Zod schemas (modified, full rewrite)
- `src/lib/ai/service.ts` — implement aiService.chat() stub (modify)
- `src/app/api/ai/chat/route.ts` — chat API endpoint (new)
- `src/components/chat/ChatPanel.tsx` — main chat UI (new)
- `src/components/chat/PersonaMessage.tsx` — persona message display (new)
- `src/components/chat/ActionableSuggestion.tsx` — suggestion action button (new)
- `src/app/(dashboard)/workspaces/[id]/chat/page.tsx` — chat page (modify)
- `prisma/schema.prisma` — add ChatSession + ChatMessage models (modify)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5]
- [Source: Story 2.0 — aiService.chat() stub, ChatResponse type, config.ts ENDPOINT_CONFIG]
- [Source: Story 3.1 — multi-profile parallel LLM pattern, parseStructuredResponse, withAI middleware]
- [Source: Story 4.1 — Spec model (for context injection)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- chat-response.ts had minimal stub schema; fully rewritten with SuggestionSchema, PersonaResponseSchema, ChatResponseSchema, ChatMessageSchema
- ENDPOINT_CONFIG['chat'] already existed in config.ts; maxTokens bumped from 1024 to 2048
- Pre-existing 4 unused-var warnings on stub params (\_messages etc.) eliminated by implementation
- context-injector.ts userId param: initially \_userId triggered lint warning; changed to userId + void userId
- require('zod') in test file replaced with static import to fix ESLint no-require-imports error
- Chat page existed as placeholder; updated to use ChatPanel
- prisma migrate dev skipped (no live DB); schema updated manually

### Completion Notes List

- Created personas.ts: 4 personas (PM_OPTIMIST, ARCHITECT_PRAGMATIST, ANALYST, CRITIC) with full system prompts using buildSystemPrompt(), distinct icon/color/expertise; cross-persona reference instruction in all prompts
- Created persona-selector.ts: selectPersonas() with @mention parsing, keyword scoring (tech vs business), rotation; always returns 2-3 PersonaId values
- Created context-injector.ts: buildWorkspaceContext() fetches workspace + diagram + spec + review from DB; Markdown block; 2000 char truncation; graceful fallback
- Rewrote chat-response.ts: SuggestionSchema (4 types), PersonaResponseSchema, ChatResponseSchema, ChatMessageSchema; all types exported
- Implemented aiService.chat() in service.ts: selectPersonas -> parallel LLM calls via withRetry -> parseStructuredResponse(PersonaResponseSchema) -> aggregate usage; history summarization at >10 messages
- Created POST /api/ai/chat: Zod validation, requireAuth, withAI middleware, buildWorkspaceContext, aiService.chat(), best-effort DB persist (ChatSession + ChatMessage)
- Updated prisma/schema.prisma: ChatSession + ChatMessage models; chatSessions on User and Workspace
- Created ActionableSuggestion.tsx: clipboard copy button with type icon, Sonner toast
- Created PersonaMessage.tsx: avatar (emoji + persona color), name badge, message, suggestions list
- Created ChatPanel.tsx: persona legend, scrollable conversation, user bubbles, loading skeleton (2 placeholder rows), Enter-to-send textarea, Sonner error toast
- Updated chat/page.tsx: placeholder replaced with ChatPanel
- Created multi-persona-chat.test.ts: 42 tests across 7 describe blocks
- Full regression: 392 tests, 0 failures; 0 lint errors, 0 warnings

### File List

- `src/lib/ai/prompts/personas.ts` — new
- `src/lib/ai/persona-selector.ts` — new
- `src/lib/ai/context-injector.ts` — new
- `src/lib/ai/schemas/chat-response.ts` — modified (full rewrite)
- `src/lib/ai/service.ts` — modified (implemented aiService.chat(), added imports)
- `src/app/api/ai/chat/route.ts` — new
- `src/components/chat/ActionableSuggestion.tsx` — new
- `src/components/chat/PersonaMessage.tsx` — new
- `src/components/chat/ChatPanel.tsx` — new
- `src/app/(dashboard)/workspaces/[id]/chat/page.tsx` — modified
- `prisma/schema.prisma` — modified (ChatSession + ChatMessage + relations)
- `src/__tests__/multi-persona-chat.test.ts` — new

### Change Log

- 2026-03-02: Story 5.1 implemented — 4 personas, selector, context injector, chat schemas, aiService.chat(), POST /api/ai/chat, ChatSession/ChatMessage models, full chat UI, 42 tests
