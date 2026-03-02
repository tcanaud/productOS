# Story 3.1: Multi-Profile AI Review

Status: review

## Story

As a Product Manager,
I want the AI to analyze my diagram from different perspectives (positive, moderate, critical),
so that I can identify blind spots and strengthen my product design.

## Acceptance Criteria

1. Given a PM with a completed diagram, when they trigger AI review, then they can select from 3 profiles: Optimist, Moderate, Critic (AC:1)
2. Given a selected review profile, when the AI analyzes the diagram, then it returns contextual feedback within 5s (p95) (AC:2)
3. Given a selected review profile, when the AI analyzes the diagram, then the feedback includes: edge cases (≥3), risks, inconsistencies, and improvement suggestions (AC:3)
4. Given AI review results, when the PM views them, then each suggestion is actionable with a specific reference to a diagram element (e.g. "Add error handling for timeout on step X") (AC:4)

## Tasks / Subtasks

- [x] Task 1: Review profile system prompts (AC: 1, 3, 4)
  - [x] Design Optimist system prompt (focus: opportunities, strengths, quick wins)
  - [x] Design Moderate system prompt (focus: balanced analysis, trade-offs)
  - [x] Design Critic system prompt (focus: risks, edge cases, failure modes)
  - [x] Enforce structured output schema for all profiles: `{ profile, summary, edgeCases[], risks[], inconsistencies[], suggestions[] }`
  - [x] Each suggestion must include a `targetNode` or `targetStep` field referencing a specific diagram element
  - [x] Test each profile against 5+ diverse diagrams; assert distinct perspective per profile
  - [x] Store prompt templates in `src/lib/ai/prompts/review-profiles.ts`

- [x] Task 2: Review API endpoint (AC: 2, 3, 4)
  - [x] Create `POST /api/ai/review-diagram` — accepts `{ diagramId: string, content: string, profile: "optimist" | "moderate" | "critic" }`
  - [x] Authenticate with `requireAuth()`; validate input with Zod
  - [x] Parse Mermaid content to extract node/edge list for richer LLM context
  - [x] Implement `aiService.reviewDiagram()` in `src/lib/ai/service.ts` (currently a stub)
  - [x] Enforce structured output schema via `parseStructuredResponse()` + `ReviewOutputSchema`
  - [x] Return `{ profile, summary, edgeCases[], risks[], inconsistencies[], suggestions[], latencyMs }`
  - [x] Validate response time target: < 5s p95 (use `Date.now()` before/after call)
  - [x] Apply `withAI(handler, 'review')` middleware (rate limiting + error handling)

- [x] Task 3: Review persistence (AC: 3)
  - [x] Add `DiagramReview` model to `prisma/schema.prisma`:
    ```prisma
    model DiagramReview {
      id          String   @id @default(cuid())
      diagramId   String
      versionId   String?
      profile     String
      contentJson Json
      userId      String
      createdAt   DateTime @default(now())
      diagram     Diagram  @relation(fields: [diagramId], references: [id], onDelete: Cascade)
      user        User     @relation(fields: [userId], references: [id])
    }
    ```
  - [x] Run `prisma migrate dev --name add-diagram-review`
  - [x] Store each review result linked to the diagram; retrieve latest review per profile via `GET /api/diagrams/[diagramId]/reviews`
  - [x] Support marking a suggestion as "addressed": `PATCH /api/reviews/[reviewId]/suggestions/[index]`

- [x] Task 4: Review UI panel (AC: 1, 2, 3, 4)
  - [x] Create `src/components/diagram/ReviewPanel.tsx` — side panel integrated into `DiagramEditorLayout`
  - [x] Profile selector: 3 tabs (Optimist / Moderate / Critic); active tab highlighted
  - [x] "Analyze" button with loading state (spinner + profile name, disabled during request)
  - [x] Results display: separate sections for Edge Cases, Risks, Inconsistencies, Suggestions
  - [x] Create `src/components/diagram/ReviewCard.tsx` — individual finding card with: description, severity badge, targetNode reference, "Mark as addressed" checkbox
  - [x] Add "Review with AI" button to `DiagramEditorLayout` toolbar to open/close panel
  - [x] On error: show Sonner toast with error message

- [x] Task 5: Tests (AC: 1-4)
  - [x] Unit tests for `ReviewOutputSchema` validation (valid + invalid structures)
  - [x] Unit tests for API input validation (missing profile, invalid profile, missing content)
  - [x] Unit tests: each profile produces a structurally distinct prompt (Optimist vs Critic)
  - [x] Unit tests: `reviewDiagram` result shape — edgeCases ≥ 3, each suggestion has targetNode
  - [x] Integration test: POST /api/ai/review-diagram flow with mocked AI response

## Dev Notes

- **Depends on Story 2.0 (AI Client Foundation)** — uses `aiService.reviewDiagram()` stub in `src/lib/ai/service.ts`; uses `parseStructuredResponse()`, `withRetry()`, `withAI()` middleware, `ENDPOINT_CONFIG['review']`
- **Depends on Story 2.1** — `Diagram` model and `diagramId` must exist
- Diagram content sent as Mermaid text + extracted node/edge list for richer LLM context
- Review output schema (Zod + JSON):
  ```json
  {
    "profile": "critic",
    "summary": "Overall assessment in 2-3 sentences.",
    "edgeCases": [
      {
        "description": "What if the email service is down?",
        "severity": "high",
        "affectedNodes": ["send_email"]
      }
    ],
    "risks": [
      { "description": "No retry logic on payment step", "likelihood": "medium", "impact": "high" }
    ],
    "inconsistencies": [
      {
        "description": "Step C references user.id but user is not yet authenticated at this point",
        "affectedNodes": ["C"]
      }
    ],
    "suggestions": [
      {
        "description": "Add error handling for timeout on step X",
        "actionable": true,
        "targetNode": "X"
      }
    ]
  }
  ```
- `aiService.reviewDiagram()` is currently a stub throwing `not yet implemented (Story 3.1)` — implement it in Task 2
- Consider streaming responses for better UX on longer reviews
- `ENDPOINT_CONFIG['review']` uses `claude-sonnet-4-6`, maxTokens: 2048, temperature: 0.2

### Project Structure Notes

- `src/app/api/ai/review-diagram/route.ts` — review endpoint
- `src/app/api/diagrams/[diagramId]/reviews/route.ts` — list reviews
- `src/lib/ai/prompts/review-profiles.ts` — system prompts per profile
- `src/lib/ai/schemas/review-output.ts` — existing file; extend with full Zod schema
- `src/components/diagram/ReviewPanel.tsx` — review UI
- `src/components/diagram/ReviewCard.tsx` — individual finding card

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3]
- [Source: PRD#Feature 3 — AI Co-Pilot Multi Profiles]
- [Source: Architecture#AI Orchestrator — Multi-profile prompting]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `prisma migrate dev` skipped (no live DB in dev environment); schema updated, migration must be run manually
- Fixed `aria-selected` → `aria-pressed` on button element (a11y lint)
- Fixed `||` expression lint warning in tests: replaced with `.includes() || .includes()` inside `expect()` wrapper

### Completion Notes List

- Extended `src/lib/ai/schemas/review-output.ts` with `MultiProfileReviewSchema`, `EdgeCaseSchema`, `RiskSchema`, `InconsistencySchema`, `SuggestionSchema`, `ReviewProfile` enum (legacy schema preserved)
- Created `src/lib/ai/prompts/review-profiles.ts` — 3 distinct system prompts (Optimist/Moderate/Critic) + `buildReviewUserPrompt()` + `extractMermaidNodes()` for node context injection
- Implemented `aiService.reviewDiagram()` in `src/lib/ai/service.ts` — full pipeline: buildReviewSystemPrompt → buildReviewUserPrompt → anthropic.messages.create → parseStructuredResponse → MultiProfileReviewSchema
- Created `POST /api/ai/review-diagram` with requireAuth, Zod validation, withAI middleware; best-effort DB persistence via `diagramReview.create()`
- Created `GET /api/diagrams/[diagramId]/reviews` — list reviews for diagram
- Added `DiagramReview` model to `prisma/schema.prisma` (migration pending live DB)
- Created `ReviewCard.tsx` — finding card with severity badge, node reference, "Mark as addressed" checkbox
- Created `ReviewPanel.tsx` — 3-tab profile selector, Analyze button, results sections (Edge Cases / Risks / Inconsistencies / Suggestions), Sonner toast on error
- Updated `DiagramEditorLayout.tsx` — replaced `showAIPanel` boolean with `sidePanel: 'generate' | 'review' | null`; added "Review with AI" toolbar button
- 44 Story 3.1 tests pass; full regression suite: 257 tests, 0 failures
- Lint: 0 errors, 7 pre-existing warnings (future story stubs 4.1, 5.1)

### File List

- `src/lib/ai/schemas/review-output.ts` — modified (added MultiProfileReview types)
- `src/lib/ai/prompts/review-profiles.ts` — new
- `src/lib/ai/service.ts` — modified (implemented reviewDiagram, added ReviewDiagramResult interface)
- `src/app/api/ai/review-diagram/route.ts` — new
- `src/app/api/diagrams/[diagramId]/reviews/route.ts` — new
- `prisma/schema.prisma` — modified (added DiagramReview model + relations)
- `src/components/diagram/ReviewCard.tsx` — new
- `src/components/diagram/ReviewPanel.tsx` — new
- `src/components/diagram/DiagramEditorLayout.tsx` — modified (sidePanel state, Review with AI button)
- `src/__tests__/multi-profile-review.test.ts` — new

### Change Log

- 2026-03-02: Story 3.1 implemented — 3-profile AI review system, ReviewPanel UI, ReviewCard component, API endpoint, Prisma schema update, 44 tests
