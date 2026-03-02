# Story 3.1: Multi-Profile AI Review

Status: ready-for-dev

## Story

As a Product Manager,
I want the AI to analyze my diagram from different perspectives (positive, moderate, critical),
so that I can identify blind spots and strengthen my product design.

## Acceptance Criteria

1. 3 review profiles are selectable: Optimist, Moderate, Critic (AC:1)
2. AI analyzes the diagram contextually and returns feedback within 5s p95 (AC:2)
3. Feedback includes: edge cases (minimum 3), risks, inconsistencies, improvement suggestions (AC:3)
4. Each suggestion is actionable with specific references to diagram elements (AC:4)

## Tasks / Subtasks

- [ ] Task 1: Review profile system prompts (AC: 1, 3)
  - [ ] Design Optimist system prompt (focus: opportunities, strengths, quick wins)
  - [ ] Design Moderate system prompt (focus: balanced analysis, trade-offs)
  - [ ] Design Critic system prompt (focus: risks, edge cases, failure modes)
  - [ ] Ensure structured output schema for all profiles
  - [ ] Test each profile against 5+ diverse diagrams
- [ ] Task 2: Review API endpoint (AC: 2, 3, 4)
  - [ ] POST /api/ai/review-diagram — accepts diagram content + profile selection
  - [ ] Parse Mermaid diagram to extract node/edge context for LLM
  - [ ] Return structured review: { edgeCases: [], risks: [], suggestions: [], summary: "" }
  - [ ] Response time target: < 5s p95
- [ ] Task 3: Review UI panel (AC: 1, 2, 3, 4)
  - [ ] Profile selector (3 tabs or toggle: Optimist / Moderate / Critic)
  - [ ] "Analyze" trigger button
  - [ ] Loading state with profile indicator
  - [ ] Results display: categorized cards (edge cases, risks, suggestions)
  - [ ] Each card references specific diagram elements (node IDs / step names)
- [ ] Task 4: Review persistence (AC: 3)
  - [ ] Create Prisma model `DiagramReview`:
    ```prisma
    model DiagramReview {
      id          String   @id @default(cuid())
      diagramId   String
      versionId   String?
      profile     String   // "optimist" | "moderate" | "critic"
      contentJson Json     // full review output
      userId      String
      createdAt   DateTime @default(now())
      diagram     Diagram  @relation(fields: [diagramId], references: [id])
      user        User     @relation(fields: [userId], references: [id])
    }
    ```
  - [ ] Run migration
  - [ ] Store reviews linked to diagram version
  - [ ] Allow PM to dismiss or mark suggestions as "addressed"
- [ ] Task 5: Tests (AC: 1-4)
  - [ ] Unit tests for review API endpoint
  - [ ] Test each profile returns distinct perspective
  - [ ] Test structured output schema compliance
  - [ ] Performance test: < 5s p95

## Dev Notes

- **Depends on Story 2.0 (AI Client Foundation)** — uses `aiService.reviewDiagram()` from `src/lib/ai/service.ts`, structured output parsing, rate limiting, and error handling middleware
- **Depends on Story 2.1** — diagrams must exist to be reviewed
- Diagram content is sent as Mermaid text + parsed node/edge list for richer context
- Structured output schema enforced via Claude tool_use (using 2.0's `parseStructuredResponse()`)
- Review output schema:
  ```json
  {
    "profile": "critic",
    "summary": "...",
    "edgeCases": [
      {"description": "...", "severity": "high", "affectedNodes": ["B", "C"]}
    ],
    "risks": [
      {"description": "...", "likelihood": "medium", "impact": "high"}
    ],
    "suggestions": [
      {"description": "...", "actionable": true, "targetNode": "D"}
    ]
  }
  ```
- Consider streaming responses for better UX on longer reviews

### Project Structure Notes

- `/src/app/api/ai/review-diagram/route.ts` — review endpoint
- `/src/lib/ai/prompts/review-profiles.ts` — system prompts per profile
- `/src/lib/ai/schemas/review-output.ts` — structured output schema
- `/src/components/diagram/ReviewPanel.tsx` — review UI
- `/src/components/diagram/ReviewCard.tsx` — individual finding card

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3]
- [Source: PRD#Feature 3 — AI Co-Pilot Multi Profiles]
- [Source: Architecture#AI Orchestrator — Multi-profile prompting]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
