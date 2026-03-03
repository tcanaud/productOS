---
stepsCompleted: [1, 2, 3]
inputDocuments: [PRD-ProductOS-v1, Architecture-ProductOS-v1, Product-Vision-v2]
lastUpdated: 2026-03-03
---

# ProductOS — Epic Breakdown (V1 + V2: Product Design Studio)

## Overview

This document provides the complete epic and story breakdown for ProductOS. Epics 0–5 cover the V1 Diagram-to-Spec Pipeline (completed). Epics 6–8 cover the V2 Product Design Studio — transforming ProductOS from a diagramming tool into a conversational product design operating system powered by multi-persona AI.

See `product-vision.md` for the full strategic vision.

## Requirements Inventory

### Functional Requirements

- FR-1: Workspace creation and management
- FR-2: Mermaid diagram editing (text + visual preview)
- FR-3: AI-powered flow generation from natural language
- FR-4: AI multi-profile review (positive, moderate, critical)
- FR-5: Automated spec generation from diagrams (PRD, stories, edge cases)
- FR-6: Markdown export of generated specs
- FR-7: Multi-persona chat for product design collaboration
- FR-8: User authentication and session management
- FR-9: Conversational product design studio with guided onboarding
- FR-10: Multi-persona AI team (BMAD party mode) for design sessions
- FR-11: Iterative diagram refinement via conversational JSON patches
- FR-12: Real-time streaming communication (SSE) between AI and frontend
- FR-13: Interactive SVG diagram with node-level actions
- FR-14: Live review indicators (severity badges on nodes)
- FR-15: Canvas spatial layout with positioned, connected artifacts

### Non-Functional Requirements

- NFR-1: Diagram generation < 3s
- NFR-2: AI response < 5s (p95)
- NFR-3: Workspace loading < 2s
- NFR-4: Autosave every 5s (all artifacts)
- NFR-5: Version history on all artifacts
- NFR-6: Consistent API error handling and validation
- NFR-7: AI rate limiting and cost tracking
- NFR-8: AI persona response < 10s (p95) via claudegraph + Claude CLI
- NFR-9: Patch animation smooth at 60fps
- NFR-10: Session state persists between conversations per workspace

### Additional Requirements

- AR-1: json2mermaid internal module (JSON graph → valid Mermaid syntax)
- AR-2: Structured AI outputs only (JSON, never free text to Mermaid directly)
- AR-3: Docker Compose dev environment (Postgres, Redis, app)
- AR-4: Project bootstrap (Next.js, TypeScript, Prisma, linting)
- AR-5: Application shell and design system foundation
- AR-6: Testing infrastructure (Vitest, RTL, AI mocks)
- AR-7: Shared AI client and orchestration layer
- AR-8: claudegraph integration (graph-based AI workflows with Claude CLI)
- AR-9: BMAD framework installed in Docker container for party mode skills
- AR-10: Per-workspace BMAD session isolation (filesystem + DB hybrid)
- AR-11: InteractionNode support in claudegraph for user-in-the-loop graphs

### FR Coverage Map

| Requirement | Epic   | Stories                           |
| ----------- | ------ | --------------------------------- |
| FR-1        | Epic 1 | 1.1                               |
| FR-2        | Epic 2 | 2.1                               |
| FR-3        | Epic 2 | 2.2                               |
| FR-4        | Epic 3 | 3.1                               |
| FR-5        | Epic 4 | 4.1                               |
| FR-6        | Epic 4 | 4.2                               |
| FR-7        | Epic 5 | 5.1                               |
| FR-8        | Epic 0 | 0.2                               |
| AR-1        | Epic 2 | 2.2 (spike dependency)            |
| AR-2        | Epic 2 | 2.0 (structured output utilities) |
| AR-3        | Epic 1 | 1.2                               |
| AR-4        | Epic 0 | 0.1                               |
| AR-5        | Epic 0 | 0.3                               |
| AR-6        | Epic 0 | 0.4                               |
| AR-7        | Epic 2 | 2.0                               |
| FR-9        | Epic 6 | 6.1, 6.3                          |
| FR-10       | Epic 6 | 6.4                               |
| FR-11       | Epic 6 | 6.5                               |
| FR-12       | Epic 6 | 6.6                               |
| FR-13       | Epic 7 | 7.1, 7.4                          |
| FR-14       | Epic 7 | 7.3                               |
| FR-15       | Epic 8 | 8.1, 8.2, 8.3                     |
| AR-8        | Epic 6 | 6.2 (claudegraph session graph)   |
| AR-9        | Epic 6 | 6.4 (BMAD in Docker)              |
| AR-10       | Epic 6 | 6.7                               |
| AR-11       | Epic 6 | 6.2                               |

## Epic List

0. **Epic 0: Foundations** — Project bootstrap, auth, app shell, testing infra
1. **Epic 1: Product Workspace** — Workspace CRUD, dev environment, navigation
2. **Epic 2: Living Diagrams** — AI client foundation, Mermaid editor, AI generation via json2mermaid
3. **Epic 3: AI Review** — Multi-profile diagram analysis
4. **Epic 4: Spec Generator** — Automated PRD, stories, edge cases + export
5. **Epic 5: Product Design Chat** — Multi-persona conversational collaboration
6. **Epic 6: Product Design Studio** — Conversational AI studio with multi-persona BMAD team, session graphs, and iterative refinement
7. **Epic 7: Interactive Diagram** — Clickable SVG, patch animations, live review indicators, node context menus
8. **Epic 8: Canvas Spatial (V2)** — Free-form canvas with positioned artifacts and visual connections

---

## Epic 6: Product Design Studio

**Goal:** Replace the linear diagram editor with a conversational AI studio where a team of expert personas guides the user from idea to validated flow through natural dialogue, powered by BMAD party mode running natively via claudegraph.

**Sprint:** Sprint 3

**Dependencies:** Epic 2 (diagrams + json2mermaid), Epic 5 (multi-persona infra), AR-8 (claudegraph), AR-9 (BMAD in Docker)

### Story 6.1: Studio Layout & Onboarding UX

As a Product Manager,
I want a welcoming studio interface with a conversation panel and diagram preview,
so that I can start designing my product through natural conversation instead of writing code.

**Acceptance Criteria:**

**Given** a PM opens a workspace
**When** they enter the studio
**Then** a split-view layout shows a conversation panel (left, ~40%) and a diagram preview area (right, ~60%)

**Given** a PM arrives on an empty workspace
**When** the studio loads
**Then** a welcoming prompt invites them to describe their idea, with inspirational suggestion chips (e.g. "E-commerce checkout flow", "User onboarding flow")

**Given** a PM clicks a suggestion chip
**When** the chip is selected
**Then** the text is pre-filled in the conversation input and ready to send

**Given** the studio is active
**When** the PM types and sends a message
**Then** the conversation panel displays the message and shows a loading state while the AI responds

### Story 6.2: Studio Session Graph (claudegraph)

As a Developer,
I want a claudegraph `studio-session.graph` that orchestrates the entire design conversation with InteractionNodes for user dialogue,
so that the AI conversation flow is structured, testable, and maintainable.

**Acceptance Criteria:**

**Given** a studio session starts
**When** the graph is initialized
**Then** it enters the `parse-user-input` node and routes based on context analysis

**Given** the graph reaches an InteractionNode
**When** it needs user input
**Then** the graph pauses execution, emits the question/prompt to the frontend, and waits for the user's response before continuing

**Given** the graph determines sufficient context exists
**When** the `enough-context?` FnNode evaluates
**Then** it routes to the `generate` LLMNode to produce a diagram

**Given** the user sends a refinement instruction
**When** the graph routes to the `refine` LLMNode
**Then** it produces a JSON patch (addNodes, removeNodes, addEdges, removeEdges, modifyNodes) instead of a full regeneration

**Given** the user validates the diagram
**When** they confirm
**Then** the graph routes to `persist` and terminates gracefully

**Technical Note:**

- Graph flow: `[parse-input] → [select-personas] → [multi-persona-respond (LLMNode)] → [present-to-user (InteractionNode)] → [route] → loop or END`
- InteractionNodes use claudegraph's native interaction API
- Session state maintained by GraphRunner between interactions

### Story 6.3: Conversational Onboarding

As a Product Manager,
I want the AI to ask me smart, adaptive questions to understand my product idea before generating a diagram,
so that the generated flow is relevant and well-structured from the start.

**Acceptance Criteria:**

**Given** a PM provides a brief description (< 50 words)
**When** the AI processes it
**Then** it asks 2-3 targeted clarification questions (actors, happy path, key constraints)

**Given** a PM provides a detailed description (> 100 words with clear actors and flow)
**When** the AI processes it
**Then** it may skip clarification and proceed directly to diagram generation with at most 1 confirmation question

**Given** the AI asks a question
**When** the PM responds
**Then** the AI acknowledges the response contextually and either asks a follow-up or proceeds to generation

**Given** the conversation reaches sufficient context
**When** the AI generates the diagram
**Then** it announces "I see the flow forming" and the diagram appears progressively in the preview

### Story 6.4: Multi-Persona AI Team (BMAD Party Mode)

As a Product Manager,
I want to interact with distinct expert personas (Product Strategist, System Designer, User Advocate, etc.) during my design session,
so that I get diverse, specialized perspectives on my product design.

**Acceptance Criteria:**

**Given** a studio session is active
**When** the AI responds
**Then** 2-3 relevant personas respond with distinct names, icons, and communication styles

**Given** the user's message is about technical architecture
**When** personas are selected
**Then** the System Designer persona is prioritized with complementary perspectives

**Given** a persona responds
**When** the response is displayed
**Then** it shows the persona's display name, icon, and styled message bubble with the persona's color

**Given** an ongoing conversation
**When** personas respond
**Then** they can reference each other naturally (e.g. "Building on what the Strategist said...")

**Technical Note:**

- BMAD must be installed in the Docker container home directory
- Claude CLI spawned by claudegraph loads `/bmad-party-mode` skill natively
- The LLMNode prompt includes workspace context + `/bmad-party-mode` command
- `.claude/settings.json` must be present in the container for skill resolution
- Persona display mapping: BMAD agent names → Studio-friendly titles (John→"Product Strategist", Winston→"System Designer", etc.)

### Story 6.5: Iterative Diagram Refinement via Chat

As a Product Manager,
I want to modify my diagram through natural language instructions in the chat,
so that I can iterate on my design without touching code.

**Acceptance Criteria:**

**Given** a PM has a generated diagram
**When** they type "Add an error flow after payment"
**Then** the AI produces a JSON patch that adds the relevant nodes and edges
**And** the diagram updates visually with the new elements

**Given** a PM types "Remove the notification step"
**When** the patch is applied
**Then** the specified node and its connected edges are removed from the diagram

**Given** a PM types "Rename 'Checkout' to 'Payment Processing'"
**When** the patch is applied
**Then** the node label is updated in the diagram

**Given** any refinement instruction
**When** the AI processes it
**Then** it returns a JSON patch (not a full regeneration) and the diagram animates the changes

**Technical Note:**

- Patch format: `{ addNodes[], removeNodes[], addEdges[], removeEdges[], modifyNodes[] }`
- Patches applied to the JsonGraph (source of truth), then re-rendered via `json2mermaid`
- The `refine-flow.graph` receives current JsonGraph + user instruction → returns patch

### Story 6.6: SSE/Streaming Communication

As a Developer,
I want real-time Server-Sent Events (SSE) streaming between the studio graph and the frontend,
so that persona responses and diagram updates appear progressively without polling.

**Acceptance Criteria:**

**Given** a studio session is active
**When** the graph produces output (persona message, diagram update, interaction prompt)
**Then** the event is streamed to the frontend via SSE within 100ms

**Given** the SSE connection drops
**When** the frontend detects disconnection
**Then** it automatically reconnects and resumes from the last event ID

**Given** multiple events are emitted rapidly
**When** the frontend receives them
**Then** they are processed in order and rendered sequentially with appropriate timing

**Event Types:**

- `persona-message`: `{ persona, displayName, icon, message }`
- `interaction`: `{ question, inputType, options? }`
- `diagram-update`: `{ patch }` (incremental)
- `diagram-full`: `{ jsonGraph, mermaidSyntax }` (initial generation)
- `review-annotation`: `{ nodeId, severity, message }`
- `session-end`: `{ summary }`

### Story 6.7: BMAD Session Isolation (Per Workspace)

As a Product Manager,
I want my AI design sessions to remember previous conversations and decisions within a workspace,
so that I can continue where I left off and the AI team retains project context.

**Acceptance Criteria:**

**Given** a PM starts a studio session in a workspace
**When** the session initializes
**Then** a BMAD session directory is created (or loaded) at `data/sessions/{workspaceId}/` with `_bmad/` structure

**Given** a PM returns to a workspace after days of inactivity
**When** they open the studio
**Then** the AI team references previous conversations and decisions from BMAD memory files

**Given** a studio session produces artifacts (diagram iterations, review notes)
**When** the session ends
**Then** session metadata is persisted in Prisma (WorkspaceSession model) and BMAD files are written to the filesystem

**Given** a workspace is deleted
**When** cleanup runs
**Then** the associated session directory is removed from the filesystem

**Technical Note:**

- DB (Prisma): `WorkspaceSession` model with workspaceId, activeAgents[], lastActivity, state
- Filesystem: `data/sessions/{workspaceId}/_bmad/` with full BMAD structure
- Claude CLI CWD set to the session directory so it loads local BMAD config
- Future: S3 sync for inactive session depopulation with on-demand rehydration

---

## Epic 7: Interactive Diagram

**Goal:** Transform the static Mermaid preview into an interactive, animated SVG where users can click nodes, see live review indicators, and interact directly with diagram elements.

**Sprint:** Sprint 4

**Dependencies:** Story 6.1 (studio layout), Story 6.5 (patch system)

### Story 7.1: Interactive SVG Diagram

As a Product Manager,
I want to click on nodes and edges in my diagram to trigger contextual actions,
so that I can interact with my design visually instead of only through chat.

**Acceptance Criteria:**

**Given** a rendered Mermaid diagram
**When** the PM hovers over a node
**Then** the node visually highlights (border glow or color shift)

**Given** a rendered Mermaid diagram
**When** the PM clicks a node
**Then** a context menu appears with actions relevant to that node

**Given** the PM clicks an edge
**When** the edge is selected
**Then** edge-specific actions are available (e.g. "Add condition", "Remove connection")

**Technical Note:**

- Mermaid renders to SVG — parse the SVG to attach click handlers to node/edge elements
- Map SVG element IDs back to JsonGraph node/edge IDs
- Consider using `mermaid.render()` + post-processing vs. a custom SVG renderer

### Story 7.2: Patch Animations

As a Product Manager,
I want to see diagram changes animated smoothly when the AI modifies the flow,
so that I can visually track what changed instead of comparing static snapshots.

**Acceptance Criteria:**

**Given** a JSON patch adds a new node
**When** the diagram re-renders
**Then** the new node fades in with a smooth animation (300ms)

**Given** a JSON patch removes a node
**When** the diagram re-renders
**Then** the removed node fades out before disappearing (200ms)

**Given** a JSON patch adds a new edge
**When** the diagram re-renders
**Then** the edge draws in progressively (line animation)

**Given** a full diagram is generated for the first time
**When** it renders
**Then** nodes appear sequentially (top-to-bottom/left-to-right) with staggered timing

### Story 7.3: Live Review Indicators

As a Product Manager,
I want to see colored badges on diagram nodes that indicate potential issues,
so that I can instantly see where risks and edge cases exist without opening a review panel.

**Acceptance Criteria:**

**Given** a diagram has been generated or modified
**When** the live review graph completes
**Then** nodes with identified issues display a colored badge (green=ok, yellow=medium, red=high/critical)

**Given** a node has a review badge
**When** the PM hovers over the badge
**Then** a tooltip shows a brief summary of the issue

**Given** a node has a review badge
**When** the PM clicks the badge
**Then** the full review detail appears (description, severity, suggestions)

**Technical Note:**

- `live-review.graph`: `[extract-nodes] → [review (LLMNode)] → [map-annotations] → END`
- Runs asynchronously after each diagram update (debounced 2s)
- Annotations stored as `{ nodeId, severity, message }[]`
- Rendered as SVG overlays on the diagram

### Story 7.4: Node Context Menu

As a Product Manager,
I want a contextual action menu when I click a diagram node,
so that I can perform AI-powered actions on specific parts of my flow.

**Acceptance Criteria:**

**Given** a PM clicks a node in the diagram
**When** the context menu appears
**Then** it offers actions: "Expand into sub-flow", "Ask a question about this node", "Simplify", "View review details"

**Given** the PM selects "Expand into sub-flow"
**When** the AI processes it
**Then** the selected node is replaced by a detailed sub-flow with multiple steps

**Given** the PM selects "Ask a question about this node"
**When** the chat opens
**Then** the conversation is pre-filled with context about the selected node

**Given** the PM selects "Simplify"
**When** the AI processes it
**Then** the node and its immediate connections are simplified (merged or reduced)

---

## Epic 8: Canvas Spatial (V2)

**Goal:** Evolve the split-view studio into a free-form spatial canvas where all artifacts (diagrams, conversations, reviews, specs, stories) are positioned and visually connected.

**Sprint:** Sprint 5+

**Dependencies:** Epic 6 (studio), Epic 7 (interactive diagram)

### Story 8.1: Canvas Data Model

As a Developer,
I want a data model for positioned, connected artifacts on a spatial canvas,
so that the studio can render all workspace artifacts in a free-form layout.

**Acceptance Criteria:**

**Given** the canvas data model is implemented
**When** an artifact is created
**Then** it has position metadata (`{ x, y, width, height }`) and a type (diagram, conversation, review, spec, story, note)

**Given** two artifacts exist on the canvas
**When** a connection is created between them
**Then** the connection is persisted with source/target IDs and optional label

**Given** the V1 split-view layout
**When** migrating to canvas
**Then** existing artifacts are positioned automatically (conversation left, diagram right)

### Story 8.2: Canvas Renderer

As a Product Manager,
I want a free-form canvas where I can pan, zoom, and arrange my design artifacts spatially,
so that I can organize my product design thinking in a way that makes sense to me.

**Acceptance Criteria:**

**Given** a workspace with multiple artifacts
**When** the PM opens the canvas view
**Then** all artifacts are rendered at their stored positions on an infinite canvas

**Given** the canvas is active
**When** the PM drags an artifact
**Then** it moves smoothly and its position is persisted

**Given** the canvas is active
**When** the PM scrolls or pinches
**Then** the canvas pans and zooms smoothly

### Story 8.3: Multi-Artifact Canvas

As a Product Manager,
I want to see my diagrams, specs, reviews, and conversations as interconnected cards on the canvas,
so that I can visualize the relationships between all my product design artifacts.

**Acceptance Criteria:**

**Given** specs have been generated from a diagram
**When** they appear on the canvas
**Then** story cards are visually connected to the diagram nodes they trace back to

**Given** a review annotation exists on a node
**When** the canvas renders
**Then** the review card is positioned near the relevant diagram node with a visual connection

**Given** multiple artifacts are connected
**When** the PM views the canvas
**Then** connection lines are drawn between related artifacts with optional labels

---

## Sprint Plan Summary

| Sprint    | Duration  | Stories                                           | Key Deliverable                                                    |
| --------- | --------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Sprint 0  | 1.5 weeks | 0.1, 0.2, 0.3, 0.4, 1.2, 1.1 + json2mermaid spike | Foundations + Dev env + Workspace + json2mermaid module            |
| Sprint 1  | 2 weeks   | 2.0, 2.1, 2.2, 3.1                                | AI client + Diagram editor + AI generation + AI review             |
| Sprint 2  | 2 weeks   | 4.1, 4.2, 5.1                                     | Spec generation + export + multi-persona chat                      |
| Sprint 3  | 3 weeks   | 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7                 | Product Design Studio (conversational + multi-persona + sessions)  |
| Sprint 4  | 2 weeks   | 7.1, 7.2, 7.3, 7.4                                | Interactive diagram (SVG, animations, review badges, context menu) |
| Sprint 5+ | 3 weeks   | 8.1, 8.2, 8.3                                     | Canvas spatial layout (free-form, multi-artifact)                  |

**Total V1 duration: 5.5 weeks (completed)**
**Total V2 duration: ~8 additional weeks**

### Sprint 0 Execution Order

| Order | Story                        | Est. Duration | Parallel?         |
| ----- | ---------------------------- | ------------- | ----------------- |
| 1     | 1.2 — Docker Compose dev env | 1 day         | ← start here      |
| 2     | 0.1 — Project Bootstrap      | 1-2 days      | parallel with 1.2 |
| 3     | 0.2 — Auth Foundation        | 2 days        | after 0.1         |
| 4     | 0.3 — App Shell & UI         | 1-2 days      | parallel with 0.2 |
| 5     | 0.4 — Testing Infrastructure | 1 day         | parallel with 0.3 |
| 6     | 1.1 — Workspace CRUD         | 2-3 days      | after 0.2 + 0.3   |
| 7     | json2mermaid spike           | 3 days        | parallel with 1.1 |

### Sprint 1 Execution Order

| Order | Story                      | Est. Duration | Parallel?                |
| ----- | -------------------------- | ------------- | ------------------------ |
| 1     | 2.0 — AI Client Foundation | 2 days        | ← start here             |
| 2     | 2.1 — Mermaid Editor       | 3-4 days      | parallel with 2.0        |
| 3     | 2.2 — AI Flow Generation   | 4-5 days      | after 2.0 + json2mermaid |
| 4     | 3.1 — Multi-Profile Review | 3-4 days      | after 2.0 + 2.1          |

### Sprint 3 Execution Order

| Order | Story                               | Est. Duration | Parallel?         |
| ----- | ----------------------------------- | ------------- | ----------------- |
| 1     | 6.1 — Studio Layout & Onboarding UX | 3 days        | ← start here      |
| 2     | 6.2 — Studio Session Graph          | 4-5 days      | after 6.1         |
| 3     | 6.6 — SSE/Streaming                 | 2-3 days      | parallel with 6.2 |
| 4     | 6.3 — Conversational Onboarding     | 3 days        | after 6.2         |
| 5     | 6.4 — Multi-Persona AI Team (BMAD)  | 3-4 days      | after 6.2         |
| 6     | 6.5 — Iterative Refinement          | 3 days        | after 6.3 + 6.4   |
| 7     | 6.7 — BMAD Session Isolation        | 2-3 days      | parallel with 6.5 |

### Sprint 4 Execution Order

| Order | Story                         | Est. Duration | Parallel?         |
| ----- | ----------------------------- | ------------- | ----------------- |
| 1     | 7.1 — Interactive SVG Diagram | 4 days        | ← start here      |
| 2     | 7.2 — Patch Animations        | 3 days        | after 7.1         |
| 3     | 7.3 — Live Review Indicators  | 3 days        | parallel with 7.2 |
| 4     | 7.4 — Node Context Menu       | 2-3 days      | after 7.1         |

## Dependency Graph

### V1 (Epics 0–5)

```
0.1 (Bootstrap) ──→ 0.2 (Auth) ──→ 1.1 (Workspace)
       │                                   │
       ├──→ 0.3 (App Shell) ───────────────┤
       │                                   │
       ├──→ 0.4 (Testing) ─ ─ ─(parallel)  │
       │                                   ↓
1.2 (Docker) ───────────────→ ALL STORIES  2.1 (Mermaid Editor)
                                           │
json2mermaid spike ──→ 2.2 (AI Gen) ──────┤
                           │               │
2.0 (AI Client) ──────────┤               │
                           ↓               ↓
                      3.1 (AI Review) ──→ 4.1 (Spec Gen) ──→ 4.2 (Export)
                           │
                           └──→ 5.1 (Chat Multi-Persona)
```

### V2 (Epics 6–8)

```
ALL V1 STORIES ──→ 6.1 (Studio Layout)
                       │
                       ├──→ 6.2 (Session Graph) ──→ 6.3 (Onboarding)
                       │        │                       │
                       │        ├──→ 6.4 (BMAD Team) ──┤
                       │        │                       ↓
                       │        └──→ 6.6 (SSE)     6.5 (Refinement)
                       │                               │
                       │                          6.7 (Session Isolation)
                       │
                       └──→ 7.1 (Interactive SVG) ──→ 7.2 (Animations)
                                    │                      │
                                    ├──→ 7.4 (Context Menu)│
                                    │                      ↓
                                    └──→ 7.3 (Live Review Indicators)
                                                           │
                                                           ↓
                                    8.1 (Canvas Data Model) ──→ 8.2 (Canvas Renderer)
                                                                      │
                                                                      ↓
                                                               8.3 (Multi-Artifact)
```

## Risk Register

| Risk                                                         | Mitigation                                                                                 | Owner     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------- |
| LLM generates invalid Mermaid                                | json2mermaid module (JSON intermediate)                                                    | Architect |
| AI review not contextual enough                              | Iterative prompt engineering + diagram AST as context                                      | Dev       |
| Spec traceability breaks                                     | Structured output with diagram node references                                             | Dev       |
| Scope creep on chat personas                                 | Limit to 4 personas MVP, reuse US-3.1 infra                                                | PM        |
| Auth adds complexity to Sprint 0                             | Use NextAuth with simple email/password, no OAuth MVP                                      | Dev       |
| Sprint 0 overloaded with foundations                         | Parallelize 1.2/0.1 and 0.3/0.4, strict timebox                                            | SM        |
| AI costs unpredictable                                       | Rate limiting + token tracking from day 1 (Story 2.0)                                      | Architect |
| Claude CLI `/bmad-party-mode` not working in spawned process | Spike test early; fallback to prompt-injected personas if needed                           | Dev       |
| InteractionNode API not matching expectations                | Explore claudegraph InteractionNode API early in Story 6.2; adapt graph pattern if needed  | Architect |
| SSE connection reliability across firewalls/proxies          | Implement auto-reconnect with last-event-ID; consider WebSocket fallback                   | Dev       |
| BMAD session filesystem grows unbounded                      | Implement TTL + cleanup job; future S3 offload for inactive sessions                       | Architect |
| Mermaid SVG click targets unreliable                         | Post-process SVG to ensure consistent element IDs; maintain JsonGraph↔SVG ID mapping       | Dev       |
| Patch animations cause jank on large diagrams                | Debounce rapid patches; limit animation to visible viewport; use CSS transitions over JS   | Dev       |
| Multi-persona responses slow (3x LLM calls)                  | BMAD party mode handles selection internally; single CLI call returns multi-persona output | Architect |
