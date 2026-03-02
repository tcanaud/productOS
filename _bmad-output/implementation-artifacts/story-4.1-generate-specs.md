# Story 4.1: Generate Specs from Diagram

Status: review

## Story

As a Product Manager,
I want to automatically generate a structured PRD with user stories and acceptance criteria from my diagrams,
so that engineering receives coherent, traceable, and immediately exploitable specs.

## Acceptance Criteria

1. Given a PM with a completed Mermaid diagram, when they trigger spec generation, then the AI produces a structured PRD with overview, goals, functional requirements (each with sourceNodes), and NFRs within 10s (p95) (AC:1)
2. Given a completed diagram, when specs are generated, then user stories are formatted as "As a [role], I want [action], so that [benefit]" — minimum 2 stories per diagram (AC:2)
3. Given a user story, when specs are generated, then each story has at least 1 acceptance criterion in Given/When/Then format, each with sourceNodes referencing diagram node IDs (AC:3)
4. Given a diagram (optionally enriched with AI review data), when specs are generated, then an edge cases list is included with description, severity (critical/high/medium/low), and sourceNodes (AC:4)
5. Given a generated spec, when the PM views any requirement, story, or AC, then it includes a sourceNodes array referencing actual diagram node IDs — enabling traceability (AC:5)
6. Given a generated spec displayed in the UI, when the PM edits any section (PRD, story, AC, edge case), then changes are persisted and the structure (JSON schema) is maintained (AC:6)

## Tasks / Subtasks

- [x] Task 1: Spec generation prompts & schemas (AC: 1, 2, 3, 4, 5)
  - [x] Create `src/lib/ai/schemas/spec-output.ts` — Zod schemas: `PRDSchema`, `UserStorySchema`, `AcceptanceCriterionSchema`, `SpecEdgeCaseSchema`, `GeneratedSpecSchema`
  - [x] Create `src/lib/ai/prompts/spec-generation.ts` — `buildSpecSystemPrompt()` and `buildSpecUserPrompt(diagramContent, nodeList, reviewSummary?)`
  - [x] PRD system prompt: enforce structured JSON output; require sourceNodes on every requirement
  - [x] User stories prompt: enforce As a/I want/So that format; min 2 stories; each story gets ≥1 GWT AC
  - [x] Edge cases prompt: severity enum critical/high/medium/low; sourceNodes required
  - [x] Add optional `reviewContext` parameter: if AI review data provided, use it to enrich edge cases and risks in specs
  - [x] Unit-test prompts produce different outputs for different diagram types

- [x] Task 2: Spec generation API endpoint (AC: 1-5)
  - [x] Create `src/app/api/ai/generate-specs/route.ts` — POST; accepts `{ diagramId: string, content: string, reviewContext?: object }`
  - [x] Authenticate with `requireAuth()`; validate input with Zod
  - [x] Extract Mermaid nodes via `extractMermaidNodes()` for richer LLM context (reuse from review-profiles.ts)
  - [x] Implement `aiService.generateSpecs()` in `src/lib/ai/service.ts` (currently a stub)
  - [x] Use `parseStructuredResponse()` + `GeneratedSpecSchema` for strict output validation
  - [x] Return `{ prd, stories, edgeCases, latencyMs }`
  - [x] Apply `withAI(handler, 'spec-generation')` middleware (rate limiting + error handling)
  - [x] Add `'spec-generation'` entry to `ENDPOINT_CONFIG` in `src/lib/ai/config.ts` (claude-sonnet-4-6, maxTokens: 4096, temperature: 0.3)

- [x] Task 3: Spec data model (AC: 5, 6)
  - [x] Add `Spec` model to `prisma/schema.prisma`:
    ```prisma
    model Spec {
      id          String    @id @default(cuid())
      diagramId   String
      contentJson Json
      userId      String
      createdAt   DateTime  @default(now())
      updatedAt   DateTime  @updatedAt
      diagram     Diagram   @relation(fields: [diagramId], references: [id], onDelete: Cascade)
      user        User      @relation(fields: [userId], references: [id])
    }
    ```
  - [x] Add `specs Spec[]` relation to `Diagram` and `User` models
  - [x] Create `PATCH /api/specs/[specId]` — accepts partial contentJson update; validates structure with Zod before persisting
  - [x] Run `prisma migrate dev --name add-spec` (documented — migration skipped, no live DB)

- [x] Task 4: Spec viewer/editor UI (AC: 6)
  - [x] Create `src/components/specs/SpecPanel.tsx` — side panel integrated into `DiagramEditorLayout`; triggered by "Generate Specs" toolbar button
  - [x] Create `src/components/specs/PRDView.tsx` — displays overview, goals, requirements table (id, description, sourceNodes chip)
  - [x] Create `src/components/specs/StoriesList.tsx` — accordion list of user stories; each story card shows role/action/benefit + expandable GWT ACs
  - [x] Create `src/components/specs/EdgeCasesTable.tsx` — list with description, severity badge, sourceNodes; sorted by severity
  - [x] Add "Generate Specs" button to `DiagramEditorLayout` toolbar; open `SpecPanel` as new sidePanel option (`sidePanel: 'generate' | 'review' | 'specs' | null`)
  - [x] On generation: show loading spinner with message "Generating specs…"; on error show Sonner toast

- [x] Task 5: Tests (AC: 1-6)
  - [x] Unit tests for `GeneratedSpecSchema` validation (valid full spec, missing sourceNodes, invalid severity, GWT format)
  - [x] Unit tests for API input validation (missing diagramId, missing content, optional reviewContext)
  - [x] Unit tests: `buildSpecUserPrompt()` includes diagram content and nodeList
  - [x] Unit tests: generated spec has ≥2 user stories, each story has ≥1 AC with sourceNodes
  - [x] Unit tests: edge cases have required severity and sourceNodes fields
  - [x] Integration test: mock AI response → `parseStructuredResponse()` → `GeneratedSpecSchema.safeParse()` → valid
  - [x] Integration test: `PATCH /api/specs/[specId]` rejects invalid structure, accepts valid patch

## Dev Notes

- **Depends on Story 2.0 (AI Client Foundation)** — uses `aiService.generateSpecs()` stub in `src/lib/ai/service.ts`; uses `parseStructuredResponse()`, `withRetry()`, `withAI()` middleware
- **Depends on Story 2.1** — `Diagram` model and `diagramId` must exist; `Workspace` model must exist
- **Depends on Story 3.1** — AI review output (`MultiProfileReview`) can be passed as optional `reviewContext` to enrich spec edge cases
- This is the **core value delivery** of the product. Quality and traceability of generated specs is paramount.
- Use `extractMermaidNodes()` (from `src/lib/ai/prompts/review-profiles.ts`) to inject node list into spec prompt for grounded sourceNodes references
- `ENDPOINT_CONFIG['spec-generation']` was already pre-configured (claude-opus-4-6, maxTokens: 8192, temperature: 0.2) — used as-is
- Structured output schema:
  ```json
  {
    "prd": {
      "overview": "string",
      "goals": ["string"],
      "requirements": [{ "id": "FR-1", "description": "string", "sourceNodes": ["A", "B"] }],
      "nfrs": [{ "id": "NFR-1", "description": "string" }]
    },
    "stories": [
      {
        "id": "US-1",
        "role": "string",
        "action": "string",
        "benefit": "string",
        "acceptanceCriteria": [
          { "given": "string", "when": "string", "then": "string", "sourceNodes": ["C"] }
        ]
      }
    ],
    "edgeCases": [{ "description": "string", "severity": "high", "sourceNodes": ["D", "E"] }]
  }
  ```

### Project Structure Notes

- `src/app/api/ai/generate-specs/route.ts` — generation endpoint
- `src/app/api/specs/[specId]/route.ts` — PATCH for editing
- `src/lib/ai/prompts/spec-generation.ts` — system + user prompts
- `src/lib/ai/schemas/spec-output.ts` — Zod output schemas
- `src/components/specs/SpecPanel.tsx` — main UI panel
- `src/components/specs/PRDView.tsx` — PRD display
- `src/components/specs/StoriesList.tsx` — stories list
- `src/components/specs/EdgeCasesTable.tsx` — edge cases table

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Story 4.1]
- [Source: PRD#Feature 4 — Spec Generator]
- [Source: Architecture#AI Orchestrator — Structured Outputs]
- [Source: Story 2.0 — AI Client Foundation (aiService.generateSpecs(), structured output, middleware)]
- [Source: Story 3.1 — AI Reviews as optional input context]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `prisma migrate dev` skipped (no live DB in dev environment); schema updated, migration must be run manually
- `ENDPOINT_CONFIG['spec-generation']` was already pre-configured in `config.ts` (added during Story 2.0)
- Pre-existing lint warnings (4) in service.ts are from the Story 5.1 `chat` stub — not introduced by this story
- `PRDSchema.default({})` — when `prd` is omitted from input, nested array defaults are applied when `prd: {}` is passed explicitly; test adjusted accordingly

### Completion Notes List

- Replaced legacy `src/lib/ai/schemas/spec-output.ts` schema with full Story 4.1 schema: `PRDSchema`, `FunctionalRequirementSchema`, `NFRSchema`, `AcceptanceCriterionSchema`, `UserStorySchema`, `SpecEdgeCaseSchema`, `GeneratedSpecSchema` (legacy `SpecOutput`/`SpecOutputSchema` aliases preserved for backward compat)
- Created `src/lib/ai/prompts/spec-generation.ts` — `buildSpecSystemPrompt()` with full JSON output format spec (sourceNodes required on all elements), `buildSpecUserPrompt()` with optional reviewContext injection
- Implemented `aiService.generateSpecs()` in `src/lib/ai/service.ts` — full pipeline: extractMermaidNodes → buildSpecSystemPrompt → buildSpecUserPrompt → anthropic.messages.create → parseStructuredResponse → GeneratedSpecSchema
- Created `POST /api/ai/generate-specs` with requireAuth, Zod validation, withAI middleware; best-effort DB persistence via `spec.create()`
- Created `PATCH /api/specs/[specId]` — validates partial update with `GeneratedSpecSchema.partial()`, merges into existing contentJson, auth + ownership check
- Added `Spec` model to `prisma/schema.prisma`; added `specs Spec[]` relations to `User` and `Diagram` (migration pending live DB)
- Created `SpecPanel.tsx` — Generate Specs button, tabbed view (PRD/Stories/Edge Cases), Sonner toast on error
- Created `PRDView.tsx` — overview, goals, requirements with sourceNode chips, NFRs
- Created `StoriesList.tsx` — accordion stories: role/action/benefit header + expandable GWT ACs with sourceNodes
- Created `EdgeCasesTable.tsx` — sorted by severity, severity badge with color coding, sourceNodes display
- Updated `DiagramEditorLayout.tsx` — added 'specs' to SidePanel type, "Generate Specs" toolbar button, SpecPanel render
- 42 Story 4.1 tests pass; full regression suite: 299 tests, 0 failures
- Lint: 0 errors on all new files; 4 pre-existing warnings in service.ts (Story 5.1 chat stub)

### File List

- `src/lib/ai/schemas/spec-output.ts` — modified (full rewrite with PRD/story/GWT/edge case schemas)
- `src/lib/ai/prompts/spec-generation.ts` — new
- `src/lib/ai/service.ts` — modified (implemented generateSpecs, added GenerateSpecsResult interface)
- `src/app/api/ai/generate-specs/route.ts` — new
- `src/app/api/specs/[specId]/route.ts` — new
- `prisma/schema.prisma` — modified (added Spec model + relations on User and Diagram)
- `src/components/specs/SpecPanel.tsx` — new
- `src/components/specs/PRDView.tsx` — new
- `src/components/specs/StoriesList.tsx` — new
- `src/components/specs/EdgeCasesTable.tsx` — new
- `src/components/diagram/DiagramEditorLayout.tsx` — modified (added 'specs' SidePanel, Generate Specs button, SpecPanel render)
- `src/__tests__/generate-specs.test.ts` — new

### Change Log

- 2026-03-02: Story 4.1 implemented — full spec generation pipeline, PRD/stories/edge cases schemas, GeneratedSpecSchema, SpecPanel UI, PATCH endpoint, Prisma Spec model, 42 tests
