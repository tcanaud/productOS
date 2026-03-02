# Story 2.0: AI Client Foundation

Status: ready-for-dev

## Story

As a Developer,
I want a shared AI orchestration layer with Claude SDK, prompt management, and structured output parsing,
so that all AI features use consistent patterns for reliability and maintainability.

## Acceptance Criteria

1. Shared Anthropic SDK client with proper error handling and retry logic (AC:1)
2. Structured output parsing and validation via shared utilities (AC:2)
3. Consistent error handling: retry once on failure, structured fallback error (AC:3)
4. Rate limiting on AI endpoints to control costs (AC:4)
5. Token usage tracking and logging for cost monitoring (AC:5)
6. Streaming response utilities available for real-time UX (AC:6)

## Tasks / Subtasks

- [ ] Task 1: Anthropic SDK setup (AC: 1)
  - [ ] Install `@anthropic-ai/sdk`
  - [ ] Create `src/lib/ai/client.ts` — singleton Anthropic client:
    - API key from environment variable
    - Default model configuration (claude-sonnet for fast, claude-opus for quality)
    - Connection timeout settings
  - [ ] Create `src/lib/ai/config.ts` — AI configuration:
    - Model selection per use case (generation, review, chat)
    - Max tokens per use case
    - Temperature settings per use case
  - [ ] Validate `ANTHROPIC_API_KEY` at startup, fail fast with clear error
- [ ] Task 2: Structured output utilities (AC: 2)
  - [ ] Create `src/lib/ai/structured-output.ts`:
    - `parseStructuredResponse<T>(response, schema)` — parse + validate with Zod
    - `extractToolUseResult<T>(response)` — extract tool_use block content
    - Handle partial/malformed JSON gracefully
  - [ ] Create Zod schemas for each AI output type:
    - `src/lib/ai/schemas/flow-graph.ts` — JSON graph for diagram generation
    - `src/lib/ai/schemas/review-output.ts` — review findings
    - `src/lib/ai/schemas/spec-output.ts` — PRD/stories/edge cases
    - `src/lib/ai/schemas/chat-response.ts` — persona responses
  - [ ] Each schema includes validation + sensible defaults for missing fields
- [ ] Task 3: Error handling & retry (AC: 3)
  - [ ] Create `src/lib/ai/error-handler.ts`:
    - `withRetry(fn, options)` — retry wrapper (1 retry by default)
    - Handle specific error types:
      - Rate limit (429) → wait + retry
      - Timeout → retry once
      - Invalid JSON response → retry with stricter prompt
      - API error → structured error response
    - `AIError` class with type, message, retryable flag
  - [ ] All AI service methods use `withRetry` wrapper
- [ ] Task 4: Rate limiting (AC: 4)
  - [ ] Create `src/lib/ai/rate-limiter.ts`:
    - Per-user rate limiting (X requests/minute)
    - Per-endpoint rate limiting (different limits for gen vs review vs chat)
    - Use Redis for distributed rate limiting (or in-memory for MVP)
    - Return 429 with retry-after header when limit exceeded
  - [ ] Default limits:
    - Flow generation: 10 req/min per user
    - Review: 10 req/min per user
    - Spec generation: 5 req/min per user
    - Chat: 20 req/min per user
- [ ] Task 5: Token tracking & logging (AC: 5)
  - [ ] Create `src/lib/ai/token-tracker.ts`:
    - Log every AI call: model, input_tokens, output_tokens, cost estimate, latency
    - Store in database: `ai_usage_logs` table
    - Aggregate by user, workspace, endpoint
  - [ ] Create Prisma model:
    ```prisma
    model AIUsageLog {
      id           String   @id @default(cuid())
      userId       String
      workspaceId  String?
      endpoint     String
      model        String
      inputTokens  Int
      outputTokens Int
      latencyMs    Int
      success      Boolean
      createdAt    DateTime @default(now())
    }
    ```
  - [ ] Migration for new table
- [ ] Task 6: Streaming utilities (AC: 6)
  - [ ] Create `src/lib/ai/streaming.ts`:
    - `streamAIResponse(prompt, options)` — returns ReadableStream
    - Server-side: use Anthropic SDK streaming API
    - Client-side: `useAIStream()` hook for consuming streams
    - Graceful handling of stream interruption
  - [ ] Create `src/hooks/useAIStream.ts` — React hook for AI streaming:
    - Returns: { data, isStreaming, error, cancel }
    - Handles SSE or chunked response parsing
- [ ] Task 7: Prompt template system (AC: 2)
  - [ ] Create `src/lib/ai/prompts/base.ts`:
    - `buildPrompt(template, variables)` — simple template interpolation
    - `buildSystemPrompt(persona, context)` — system prompt builder
    - `injectContext(prompt, workspaceContext)` — context injection helper
  - [ ] Prompt templates stored as typed constants (not files)
  - [ ] Each template includes: system prompt, expected output schema reference
- [ ] Task 8: AI service facade (AC: 1-6)
  - [ ] Create `src/lib/ai/service.ts` — main AI service:
    - `generateFlow(description, options)` — for Story 2.2
    - `reviewDiagram(diagram, profile, options)` — for Story 3.1
    - `generateSpecs(diagram, reviews, options)` — for Story 4.1
    - `chat(messages, personas, context, options)` — for Story 5.1
    - Each method: builds prompt → calls client → parses output → tracks tokens → returns typed result
  - [ ] All methods are thin wrappers — actual prompt content defined in feature stories
  - [ ] Methods return `AIResult<T>` type: `{ data: T, usage: TokenUsage, latencyMs: number }`
- [ ] Task 9: API middleware (AC: 3, 4)
  - [ ] Create `src/lib/ai/middleware.ts`:
    - `withAIRateLimit(handler, endpoint)` — rate limiting middleware
    - `withAIErrorHandling(handler)` — consistent error responses for AI endpoints
    - Composable: `withAI = compose(withAIRateLimit, withAIErrorHandling)`
  - [ ] Standard AI error response format:
    ```json
    { "error": { "type": "rate_limit", "message": "...", "retryAfter": 30 } }
    ```
- [ ] Task 10: Tests (AC: 1-6)
  - [ ] Unit tests for structured output parsing (valid + invalid JSON)
  - [ ] Unit tests for retry logic (success after retry, max retries exceeded)
  - [ ] Unit tests for rate limiter (within limit, exceeded)
  - [ ] Unit tests for token tracker (correct values logged)
  - [ ] Integration test: full flow — build prompt → mock client → parse response → track tokens

## Dev Notes

- **This is Sprint 1's first story** — blocks 2.2, 3.1, 4.1, 5.1
- The service facade methods are **stubs** initially — actual prompts are defined in each feature story
- Use Claude tool_use (function calling) for structured output — more reliable than raw JSON
- Zod schemas serve double duty: validate AI output AND define TypeScript types
- Rate limiting: start with in-memory (simple Map with TTL), move to Redis when needed
- Token tracking: essential for cost monitoring from day 1 — AI costs can surprise
- Streaming: implement the utility but don't require it for MVP features (nice-to-have UX)
- Model selection strategy:
  - `claude-sonnet-4-6` for fast tasks (review, chat responses)
  - `claude-opus-4-6` for complex tasks (spec generation, flow generation)
  - Configurable per endpoint

### Project Structure Notes

- `/src/lib/ai/client.ts` — Anthropic SDK singleton
- `/src/lib/ai/config.ts` — model/token configuration
- `/src/lib/ai/service.ts` — main AI service facade
- `/src/lib/ai/structured-output.ts` — output parsing utilities
- `/src/lib/ai/error-handler.ts` — retry and error handling
- `/src/lib/ai/rate-limiter.ts` — rate limiting
- `/src/lib/ai/token-tracker.ts` — usage tracking
- `/src/lib/ai/streaming.ts` — streaming utilities
- `/src/lib/ai/middleware.ts` — API middleware for AI routes
- `/src/lib/ai/prompts/base.ts` — prompt template system
- `/src/lib/ai/schemas/` — Zod schemas for each output type
- `/src/hooks/useAIStream.ts` — client-side streaming hook

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 — Story 2.0]
- [Source: Architecture#AI Orchestrator Service]
- [Source: PRD#AI Safety — explainability, citations, validation]
- [Source: PRD#NFR — AI response < 5s p95]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
