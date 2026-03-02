# Story 4.1: Generate Specs from Diagram

Status: ready-for-dev

## Story

As a Product Manager,
I want to automatically generate a structured PRD with user stories and edge cases from my diagrams,
so that engineering receives coherent, exploitable specs.

## Acceptance Criteria

1. AI generates a structured PRD (overview, goals, requirements, NFRs) from diagram + review (AC:1)
2. AI generates user stories in "As a... I want... So that..." format (AC:2)
3. Acceptance criteria are in Given/When/Then format (AC:3)
4. Edge cases list with severity is included (AC:4)
5. Each spec element is traceable back to source diagram elements (AC:5)
6. PM can edit any generated section while maintaining structure (AC:6)

## Tasks / Subtasks

- [ ] Task 1: Spec generation prompts (AC: 1, 2, 3, 4, 5)
  - [ ] Design PRD generation system prompt with structured output
  - [ ] Design user stories generation prompt (from diagram nodes/flows)
  - [ ] Design acceptance criteria prompt (Given/When/Then per story)
  - [ ] Design edge cases extraction prompt (from diagram + review data)
  - [ ] Add traceability: each output references source diagram node IDs
  - [ ] Test across 5+ diverse diagrams
- [ ] Task 2: Spec generation API (AC: 1-5)
  - [ ] POST /api/ai/generate-specs — accepts diagram + reviews, returns full spec
  - [ ] Pipeline: diagram content + AI reviews → LLM → structured spec output
  - [ ] Output schema: { prd: {...}, stories: [...], edgeCases: [...] }
  - [ ] Store generated specs as artifacts linked to workspace + diagram
- [ ] Task 3: Spec data model (AC: 5, 6)
  - [ ] Create `specs` table (id, workspace_id, diagram_id, type, content_json, created_at)
  - [ ] Create `spec_traceability` table (spec_element_id, diagram_node_id)
  - [ ] Migration scripts
- [ ] Task 4: Spec viewer/editor UI (AC: 6)
  - [ ] Tabbed view: PRD | Stories | Edge Cases
  - [ ] PRD view with editable sections (rich markdown editor)
  - [ ] Stories list view with expandable cards
  - [ ] Edge cases table with severity indicators
  - [ ] Traceability links: click spec element → highlights diagram node
  - [ ] Edit any section inline, changes saved to spec artifact
- [ ] Task 5: Tests (AC: 1-6)
  - [ ] Unit tests for spec generation API
  - [ ] Test structured output compliance (PRD format, story format, GWT format)
  - [ ] Test traceability linkage (spec → diagram node)
  - [ ] Integration test: diagram → generate specs → edit → save

## Dev Notes

- **Depends on Story 2.0 (AI Client Foundation)** — uses `aiService.generateSpecs()` from `src/lib/ai/service.ts`, structured output parsing from `src/lib/ai/structured-output.ts`, and rate limiting/error handling middleware from `src/lib/ai/middleware.ts`
- **Depends on Story 3.1** — uses AI reviews as input context for spec generation
- This is the **core value delivery** of the product. Quality of generated specs is paramount.
- Spec generation uses ALL available context: diagram + AI reviews + any chat history
- Structured output is critical — enforce via Story 2.0's Claude tool_use / JSON schema utilities
- PRD output structure:
  ```json
  {
    "prd": {
      "overview": "...",
      "goals": ["..."],
      "requirements": [{"id": "FR-1", "description": "...", "sourceNodes": ["A", "B"]}],
      "nfrs": [{"id": "NFR-1", "description": "..."}]
    },
    "stories": [
      {
        "id": "US-1",
        "role": "PM",
        "action": "...",
        "benefit": "...",
        "acceptanceCriteria": [
          {"given": "...", "when": "...", "then": "...", "sourceNodes": ["C"]}
        ]
      }
    ],
    "edgeCases": [
      {"description": "...", "severity": "high", "sourceNodes": ["D", "E"]}
    ]
  }
  ```
- Consider chunked generation for large diagrams (PRD first, then stories, then edge cases)

### Project Structure Notes

- `/src/app/api/ai/generate-specs/route.ts` — generation endpoint
- `/src/lib/ai/prompts/spec-generation.ts` — system prompts
- `/src/lib/ai/schemas/spec-output.ts` — structured output schema
- `/src/app/(dashboard)/workspace/[id]/specs/` — specs viewer page
- `/src/components/specs/PRDView.tsx` — PRD display/edit
- `/src/components/specs/StoriesList.tsx` — stories list
- `/src/components/specs/EdgeCasesTable.tsx` — edge cases table
- `/src/components/specs/TraceabilityLink.tsx` — diagram linkage

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Story 4.1]
- [Source: PRD#Feature 4 — Spec Generator]
- [Source: Architecture#AI Orchestrator — Structured Outputs]
- [Source: Story 2.0 — AI Client Foundation (aiService.generateSpecs(), structured output, middleware)]
- [Source: Story 3.1 — AI Reviews as input context]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
