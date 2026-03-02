# Story 5.1: Multi-Persona Product Design Chat

Status: ready-for-dev

## Story

As a Product Manager,
I want to discuss my product design with AI agents that have distinct expert personalities (Analyst, Architect, Critic, etc.),
so that I can challenge and refine my thinking as if collaborating with a senior team.

## Acceptance Criteria

1. 3+ personas available: PM Optimist, Architect Pragmatist, Critic, Analyst (AC:1)
2. 2-3 relevant personas respond per message with distinct communication styles (AC:2)
3. Personas reference workspace artifacts (diagrams, specs) contextually (AC:3)
4. Actionable suggestions can be applied directly (e.g. "Add edge case to diagram") (AC:4)
5. Personas can build on, challenge, or complement each other naturally (AC:5)

## Tasks / Subtasks

- [ ] Task 1: Persona definitions (AC: 1, 2, 5)
  - [ ] Define 4 personas with distinct system prompts:
    - PM Optimist: opportunities, user value, market potential
    - Architect Pragmatist: feasibility, scalability, trade-offs
    - Analyst: data, edge cases, requirements gaps
    - Critic: risks, failure modes, what could go wrong
  - [ ] Each persona has: name, icon, communication style, principles, expertise
  - [ ] Test persona differentiation across same input
- [ ] Task 2: Persona selection intelligence (AC: 2)
  - [ ] Implement topic analysis for automatic persona selection
  - [ ] Rules: technical topics → Architect + Critic; business topics → PM + Analyst
  - [ ] Allow user to @mention specific persona by name
  - [ ] Rotate participation over time for diverse perspectives
- [ ] Task 3: Context injection pipeline (AC: 3)
  - [ ] Gather workspace context: current diagrams, specs, previous reviews
  - [ ] Inject as structured context in each persona's prompt
  - [ ] Summarize context if too large for token window
  - [ ] Ensure each persona can reference specific artifacts by name
- [ ] Task 4: Chat API (AC: 1-5)
  - [ ] POST /api/ai/chat — accepts message + workspace context + conversation history
  - [ ] Returns array of persona responses: [{ persona, message, suggestions }]
  - [ ] Enable cross-referencing between persona responses
  - [ ] Store conversation history per workspace
- [ ] Task 5: Chat UI (AC: 1-5)
  - [ ] Chat panel (side panel or dedicated page within workspace)
  - [ ] Message input with send button
  - [ ] Persona responses displayed with icon + name + styled message
  - [ ] Visual distinction between personas (color coding, icons)
  - [ ] Actionable suggestion buttons (e.g. "Apply to diagram" → triggers edit)
  - [ ] Conversation history with scroll
- [ ] Task 6: Conversation persistence (AC: 3)
  - [ ] Create `chat_sessions` table (id, workspace_id, created_at)
  - [ ] Create `chat_messages` table (id, session_id, role, persona, content, timestamp)
  - [ ] Load previous conversations on workspace entry
- [ ] Task 7: Tests (AC: 1-5)
  - [ ] Unit tests for persona selection logic
  - [ ] Test each persona produces distinct output style
  - [ ] Test context injection includes relevant artifacts
  - [ ] Integration test: send message → receive multi-persona response → verify format

## Dev Notes

- **Depends on Story 2.0 (AI Client Foundation)** — uses `aiService.chat()` from `src/lib/ai/service.ts`, streaming utilities from `src/lib/ai/streaming.ts`, rate limiting and error handling middleware
- **Reuses 70% of Epic 3 (AI Review) infrastructure**: same multi-prompt pattern, same structured output
- Key difference: conversational (stateful) vs one-shot (review)
- Architecture:
  ```
  User message
      ↓
  Topic analysis → select 2-3 personas
      ↓
  For each persona:
    system_prompt(persona) + workspace_context + conversation_history + user_message
      ↓
  LLM call (can be parallel for speed)
      ↓
  Combine responses + enable cross-references
  ```
- Persona prompts should include instructions to reference other personas' points
- Token management: summarize conversation history beyond last 10 messages
- Consider streaming responses for better UX (persona by persona)
- Actionable suggestions: v1 can be simple "copy to clipboard" or "open in editor"

### Project Structure Notes

- `/src/app/api/ai/chat/route.ts` — chat endpoint
- `/src/lib/ai/prompts/personas.ts` — persona definitions and system prompts
- `/src/lib/ai/persona-selector.ts` — topic analysis and persona selection
- `/src/lib/ai/context-injector.ts` — workspace context gathering
- `/src/app/(dashboard)/workspace/[id]/chat/` — chat page
- `/src/components/chat/ChatPanel.tsx` — main chat component
- `/src/components/chat/PersonaMessage.tsx` — individual persona response
- `/src/components/chat/ActionableSuggestion.tsx` — suggestion action buttons

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5]
- [Source: PRD#Feature 3 — AI Co-Pilot Multi Profiles]
- [Source: Architecture#AI Orchestrator — Multi-profile prompting]
- [Source: Story 2.0 — AI Client Foundation (aiService.chat(), streaming utilities, rate limiting)]
- [Source: Story 3.1 — shared infrastructure for multi-profile AI]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
