---
stepsCompleted: [1, 2, 3]
inputDocuments: [PRD-ProductOS-v1, Architecture-ProductOS-v1]
---

# ProductOS — Epic Breakdown (V1: Diagram-to-Spec Pipeline)

## Overview

This document provides the complete epic and story breakdown for ProductOS V1, focused on delivering the core Diagram-to-Spec Pipeline. A PM can go from idea to exploitable specs in under 30 minutes.

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

### Non-Functional Requirements

- NFR-1: Diagram generation < 3s
- NFR-2: AI response < 5s (p95)
- NFR-3: Workspace loading < 2s
- NFR-4: Autosave every 5s (all artifacts)
- NFR-5: Version history on all artifacts
- NFR-6: Consistent API error handling and validation
- NFR-7: AI rate limiting and cost tracking

### Additional Requirements

- AR-1: json2mermaid internal module (JSON graph → valid Mermaid syntax)
- AR-2: Structured AI outputs only (JSON, never free text to Mermaid directly)
- AR-3: Docker Compose dev environment (Postgres, Redis, app)
- AR-4: Project bootstrap (Next.js, TypeScript, Prisma, linting)
- AR-5: Application shell and design system foundation
- AR-6: Testing infrastructure (Vitest, RTL, AI mocks)
- AR-7: Shared AI client and orchestration layer

### FR Coverage Map

| Requirement | Epic | Stories |
|---|---|---|
| FR-1 | Epic 1 | 1.1 |
| FR-2 | Epic 2 | 2.1 |
| FR-3 | Epic 2 | 2.2 |
| FR-4 | Epic 3 | 3.1 |
| FR-5 | Epic 4 | 4.1 |
| FR-6 | Epic 4 | 4.2 |
| FR-7 | Epic 5 | 5.1 |
| FR-8 | Epic 0 | 0.2 |
| AR-1 | Epic 2 | 2.2 (spike dependency) |
| AR-2 | Epic 2 | 2.0 (structured output utilities) |
| AR-3 | Epic 1 | 1.2 |
| AR-4 | Epic 0 | 0.1 |
| AR-5 | Epic 0 | 0.3 |
| AR-6 | Epic 0 | 0.4 |
| AR-7 | Epic 2 | 2.0 |

## Epic List

0. **Epic 0: Foundations** — Project bootstrap, auth, app shell, testing infra
1. **Epic 1: Product Workspace** — Workspace CRUD, dev environment, navigation
2. **Epic 2: Living Diagrams** — AI client foundation, Mermaid editor, AI generation via json2mermaid
3. **Epic 3: AI Review** — Multi-profile diagram analysis
4. **Epic 4: Spec Generator** — Automated PRD, stories, edge cases + export
5. **Epic 5: Product Design Chat** — Multi-persona conversational collaboration

---

## Epic 0: Foundations

**Goal:** Establish all technical foundations so that feature stories can be implemented without infrastructure blockers.

**Sprint:** Sprint 0

### Story 0.1: Project Bootstrap

As a Developer,
I want a fully scaffolded Next.js project with TypeScript, Prisma, linting, and dev tooling,
so that I can start writing feature code immediately on a solid foundation.

**Acceptance Criteria:**

**Given** a developer clones the repository
**When** they inspect the project
**Then** Next.js 14+ App Router is initialized with TypeScript strict mode

**Given** the project is scaffolded
**When** a developer writes code
**Then** ESLint + Prettier enforce consistent code style automatically

**Given** the project is scaffolded
**When** a developer runs `prisma migrate dev`
**Then** Prisma is configured with PostgreSQL, initial schema (users, workspaces) is applied

**Given** the project is ready
**When** a developer imports modules
**Then** path aliases (`@/`) and Tailwind CSS are configured and working

### Story 0.2: Authentication Foundation

As a Product Manager,
I want to log in securely to access my workspaces,
so that my product data is protected and scoped to my account.

**Acceptance Criteria:**

**Given** an unauthenticated user
**When** they visit any protected page
**Then** they are redirected to the login page

**Given** a user on the login page
**When** they authenticate (email/password for MVP)
**Then** a session is created and they are redirected to the dashboard

**Given** an authenticated user
**When** API endpoints are called
**Then** auth middleware validates the session and provides user context

**Given** a user
**When** they click "Sign out"
**Then** their session is destroyed and they are redirected to login

### Story 0.3: Application Shell & UI Foundation

As a Developer,
I want a shared application shell with layout, navigation, and base UI components,
so that all feature pages have consistent UX and shared infrastructure.

**Acceptance Criteria:**

**Given** an authenticated user
**When** they navigate the application
**Then** a consistent layout with header (logo, user menu) and sidebar navigation is displayed

**Given** any page in the application
**When** a background operation completes or fails
**Then** toast notifications provide feedback to the user

**Given** any feature component
**When** it throws an error
**Then** error boundaries catch it gracefully without crashing the entire application

**Given** the design system
**When** developers build UI
**Then** base components (buttons, inputs, cards, modals, tabs) are available via shadcn/ui

### Story 0.4: Testing Infrastructure

As a Developer,
I want a configured testing framework with utilities and mocks,
so that I can write and run tests for every story without setup overhead.

**Acceptance Criteria:**

**Given** the testing infrastructure is set up
**When** a developer runs `npm test`
**Then** Vitest executes unit and integration tests with React Testing Library

**Given** an AI-dependent feature
**When** tests are written
**Then** mock fixtures for Claude API responses are available and documented

**Given** a database-dependent test
**When** it runs
**Then** a test database is used with automatic setup and teardown

**Given** code is pushed
**When** CI runs
**Then** all tests execute in a GitHub Actions pipeline

---

## Epic 1: Product Workspace

**Goal:** Enable PMs to create and manage product workspaces as containers for all design artifacts.

**Sprint:** Sprint 0

**Dependencies:** Epic 0 (0.1, 0.2, 0.3)

### Story 1.1: Create and Manage Workspace

As a Product Manager,
I want to create a named workspace with a description,
so that I can centralize all product design artifacts in one place.

**Acceptance Criteria:**

**Given** a logged-in PM on the dashboard
**When** they click "New Workspace" and enter name + description
**Then** the workspace is created in < 30s
**And** the PM is set as owner with full permissions

**Given** a PM on the dashboard
**When** they view their workspace list
**Then** all their workspaces are listed with name, description, and last modified date

**Given** a PM inside a workspace
**When** they navigate the workspace
**Then** they see a dashboard of linked artifacts (diagrams, specs, chat history)

### Story 1.2: Docker Compose Dev Environment

As a Developer,
I want a docker-compose setup that provisions the complete dev environment (Postgres, Redis, app),
so that I can start developing immediately with a single command.

**Acceptance Criteria:**

**Given** a developer with Docker installed
**When** they run `docker compose up`
**Then** all services start: Postgres (with pgvector), Redis, and Next.js app in dev mode

**Given** the dev environment is running
**When** the developer modifies source code
**Then** hot reload works instantly (volume-mounted source)

**Given** a fresh clone of the repository
**When** the developer runs `docker compose up` for the first time
**Then** database migrations run automatically and seed data is applied

---

## Epic 2: Living Diagrams

**Goal:** Provide a Mermaid diagram editor with AI-powered generation using a reliable JSON-to-Mermaid pipeline.

**Sprint:** Sprint 0 (spike) + Sprint 1

**Dependencies:** Epic 0, Story 1.1

**Technical Dependency:** json2mermaid module must be built first (Sprint 0 spike).

### Story 2.0: AI Client Foundation

As a Developer,
I want a shared AI orchestration layer with Claude SDK, prompt management, and structured output parsing,
so that all AI features use consistent patterns for reliability and maintainability.

**Acceptance Criteria:**

**Given** the AI client is set up
**When** any feature calls the AI service
**Then** it uses a shared Anthropic SDK client with proper error handling and retry logic

**Given** an AI endpoint
**When** it receives a response from Claude
**Then** structured output is parsed and validated via shared utilities

**Given** any AI call
**When** it fails or times out
**Then** consistent error handling (retry once, structured fallback error) is applied

**Given** AI features are in use
**When** calls are made
**Then** rate limiting and token usage tracking are enforced

### Story 2.1: Edit Mermaid Diagrams

As a Product Manager,
I want to create and edit Mermaid diagrams in a text editor with live visual preview,
so that I can model my product flows visually.

**Acceptance Criteria:**

**Given** a PM inside a workspace
**When** they create a new diagram
**Then** a Monaco editor opens with Mermaid syntax highlighting

**Given** a PM editing Mermaid code
**When** they type valid Mermaid syntax
**Then** a live preview renders in real-time (< 500ms)

**Given** a PM editing a diagram
**When** changes are made
**Then** the diagram is autosaved every 5s
**And** version history is maintained

### Story 2.2: Generate Flow via AI

As a Product Manager,
I want to describe my product flow in natural language and get a valid Mermaid diagram generated by AI,
so that I can quickly model my ideas without learning Mermaid syntax.

**Acceptance Criteria:**

**Given** a PM in the diagram editor
**When** they enter a natural language description (e.g. "User signup flow with email verification")
**Then** the AI generates a structured JSON graph
**And** the json2mermaid module converts it to valid Mermaid syntax
**And** the diagram renders correctly in < 3s

**Given** an AI-generated diagram
**When** the PM views it
**Then** the AI provides a text explanation of its assumptions and design choices

**Given** an AI-generated diagram
**When** the PM wants to modify it
**Then** the diagram is fully editable in the Monaco editor

**Technical Note — json2mermaid Spike:**
- Sprint 0 timebox: 3 days
- Scope: flowchart + stateDiagram + sequenceDiagram support
- Plan A: LLM → JSON graph → json2mermaid → Mermaid syntax (deterministic)
- Plan B: LLM → JSON intermediate → client-side Mermaid transform
- Success criteria: 95%+ valid Mermaid output from structured JSON input
- Potential open-source publication

---

## Epic 3: AI Review

**Goal:** Allow PMs to get their diagrams analyzed from multiple perspectives to surface risks, edge cases, and improvements.

**Sprint:** Sprint 1

**Dependencies:** Story 2.0 (AI client), Story 2.1 (diagrams exist)

### Story 3.1: Multi-Profile AI Review

As a Product Manager,
I want the AI to analyze my diagram from different perspectives (positive, moderate, critical),
so that I can identify blind spots and strengthen my product design.

**Acceptance Criteria:**

**Given** a PM with a completed diagram
**When** they trigger AI review
**Then** they can select from 3 profiles: Optimist, Moderate, Critic

**Given** a selected review profile
**When** the AI analyzes the diagram
**Then** it returns contextual feedback within 5s (p95)
**And** the feedback includes: edge cases (≥3), risks, inconsistencies, and improvement suggestions

**Given** AI review results
**When** the PM views them
**Then** each suggestion is actionable (e.g. "Add error handling for timeout on step X")

---

## Epic 4: Spec Generator

**Goal:** Automatically generate structured, exploitable specifications from diagrams and AI reviews.

**Sprint:** Sprint 2

**Dependencies:** Story 2.0 (AI client), Story 2.1 (diagrams), Story 3.1 (reviews as input)

### Story 4.1: Generate Specs from Diagram

As a Product Manager,
I want to automatically generate a structured PRD with user stories and edge cases from my diagrams,
so that engineering receives coherent, exploitable specs.

**Acceptance Criteria:**

**Given** a PM with a diagram + AI review in their workspace
**When** they trigger spec generation
**Then** the AI generates:
- A structured PRD (overview, goals, requirements, NFRs)
- User stories in standard format (As a... I want... So that...)
- Acceptance criteria in Given/When/Then format
- Edge cases list with severity

**Given** generated specs
**When** the PM views them
**Then** each spec element is traceable back to the source diagram element

**Given** generated specs
**When** the PM reviews them
**Then** they can edit any section while maintaining structure

### Story 4.2: Export Specs as Markdown

As a Product Manager,
I want to export my generated specs as Markdown files,
so that I can share them with my team via any channel.

**Acceptance Criteria:**

**Given** generated specs in a workspace
**When** the PM clicks "Export"
**Then** they can choose: full export (all specs) or individual (PRD only, stories only, etc.)

**Given** an export selection
**When** the export runs
**Then** a clean Markdown file is downloaded with proper formatting and section headers

---

## Epic 5: Product Design Chat

**Goal:** Provide a multi-persona AI chat where PMs can collaboratively design their product with diverse expert perspectives.

**Sprint:** Sprint 2

**Dependencies:** Story 2.0 (AI client), Story 3.1 (shared multi-profile infra)

### Story 5.1: Multi-Persona Product Design Chat

As a Product Manager,
I want to discuss my product design with AI agents that have distinct expert personalities (Analyst, Architect, Critic, etc.),
so that I can challenge and refine my thinking as if collaborating with a senior team.

**Acceptance Criteria:**

**Given** a PM inside a workspace with existing artifacts
**When** they open the Product Design Chat
**Then** 3+ personas are available (e.g. PM Optimist, Architect Pragmatist, Critic, Analyst)

**Given** a PM sends a message in the chat
**When** the AI responds
**Then** 2-3 relevant personas respond with distinct communication styles
**And** personas reference workspace artifacts (diagrams, specs) in context

**Given** a persona suggests a change
**When** the suggestion is actionable
**Then** the PM can apply it directly (e.g. "Add this edge case to the diagram")

**Given** an ongoing conversation
**When** personas interact
**Then** they can build on, challenge, or complement each other's points naturally

---

## Sprint Plan Summary

| Sprint | Duration | Stories | Key Deliverable |
|---|---|---|---|
| Sprint 0 | 1.5 weeks | 0.1, 0.2, 0.3, 0.4, 1.2, 1.1 + json2mermaid spike | Foundations + Dev env + Workspace + json2mermaid module |
| Sprint 1 | 2 weeks | 2.0, 2.1, 2.2, 3.1 | AI client + Diagram editor + AI generation + AI review |
| Sprint 2 | 2 weeks | 4.1, 4.2, 5.1 | Spec generation + export + multi-persona chat |

**Total estimated duration: 5.5 weeks (2 devs)**

### Sprint 0 Execution Order

| Order | Story | Est. Duration | Parallel? |
|---|---|---|---|
| 1 | 1.2 — Docker Compose dev env | 1 day | ← start here |
| 2 | 0.1 — Project Bootstrap | 1-2 days | parallel with 1.2 |
| 3 | 0.2 — Auth Foundation | 2 days | after 0.1 |
| 4 | 0.3 — App Shell & UI | 1-2 days | parallel with 0.2 |
| 5 | 0.4 — Testing Infrastructure | 1 day | parallel with 0.3 |
| 6 | 1.1 — Workspace CRUD | 2-3 days | after 0.2 + 0.3 |
| 7 | json2mermaid spike | 3 days | parallel with 1.1 |

### Sprint 1 Execution Order

| Order | Story | Est. Duration | Parallel? |
|---|---|---|---|
| 1 | 2.0 — AI Client Foundation | 2 days | ← start here |
| 2 | 2.1 — Mermaid Editor | 3-4 days | parallel with 2.0 |
| 3 | 2.2 — AI Flow Generation | 4-5 days | after 2.0 + json2mermaid |
| 4 | 3.1 — Multi-Profile Review | 3-4 days | after 2.0 + 2.1 |

## Dependency Graph

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

## Risk Register

| Risk | Mitigation | Owner |
|---|---|---|
| LLM generates invalid Mermaid | json2mermaid module (JSON intermediate) | Architect |
| AI review not contextual enough | Iterative prompt engineering + diagram AST as context | Dev |
| Spec traceability breaks | Structured output with diagram node references | Dev |
| Scope creep on chat personas | Limit to 4 personas MVP, reuse US-3.1 infra | PM |
| Auth adds complexity to Sprint 0 | Use NextAuth with simple email/password, no OAuth MVP | Dev |
| Sprint 0 overloaded with foundations | Parallelize 1.2/0.1 and 0.3/0.4, strict timebox | SM |
| AI costs unpredictable | Rate limiting + token tracking from day 1 (Story 2.0) | Architect |
