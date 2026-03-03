---
version: 2.0
previousVersion: 'V1 — Diagram-to-Spec Pipeline'
date: 2026-03-03
authors: [tcanaud, bmad-party-mode-session]
---

# ProductOS — Product Vision (V2: Product Design Studio)

## Vision Statement

**ProductOS transforms an idea into a development-ready backlog through an AI-augmented visual conversation with a team of expert personas.**

ProductOS is not a diagramming tool. It is a **Product Design Operating System** — a unified workspace where founders, product managers, and tech leads enter with a vague idea and leave with validated flows, structured specs, and actionable user stories.

## Strategic Positioning

### What ProductOS Is NOT

- Not a Mermaid editor with AI bolted on
- Not another diagramming tool (Miro, Lucidchart, Whimsical)
- Not a generic AI chatbot

### What ProductOS IS

- A **conversational product design studio** where AI is a co-designer, not an assistant
- A **multi-persona expert team** that guides, challenges, and structures product thinking
- A **living workspace** where diagrams, specs, reviews, and stories are interconnected artifacts that evolve together
- An **intelligent environment** that remembers project context and learns from each session

### Market Differentiation

The current landscape is fragmented: brainstorm in Miro, write specs in Notion, create stories in Jira, use ChatGPT between each step. **ProductOS unifies the entire product design flow into a single AI-augmented experience.**

No competitor offers an AI co-designer that understands product design methodology, maintains persistent project memory, and operates as a team of specialized experts.

## Core User Experience

### The 3-Act User Journey

#### Act 1 — "I have an idea"

The user arrives on a clean, welcoming canvas. A warm prompt invites them: _"Describe your product idea, feature, or process. I'll help you structure it visually."_

The user types their idea. The AI doesn't immediately generate a diagram. First, a **team of expert personas engages in conversation** — a Product Strategist asks "why this product?", a System Designer asks about constraints, a User Advocate asks "for whom?". The conversation is natural, adaptive — if the user provides detailed input, fewer questions are asked.

#### Act 2 — "It takes shape"

After sufficient context, the AI says: _"I see the flow forming. Here's my proposal:"_ — and a diagram **emerges progressively** in the preview area. Node by node, edge by edge, with fluid animation.

The user continues the conversation: "Add an error flow after payment", "Simplify the left branch", "What if the card is declined?". Each instruction produces a **visual patch** — the user sees modifications applied in real-time. Ghost nodes (semi-transparent suggestions) appear for the user to accept or dismiss with a click.

Review indicators (colored badges) appear on nodes, signaling complexity, unhandled edge cases, or risks. The user clicks to see details.

#### Act 3 — "It's solid"

After 4-5 iterations, the diagram is mature. The user generates specs — user stories, acceptance criteria, edge cases — that appear as cards spatially linked to diagram nodes. They export everything as markdown for the dev team.

Three days later, the user returns. The personas remember: "Last time we discussed the notification flow — shall we continue?"

## Architecture Pillars

### 1. Conversational Flow Design (V1 Priority)

The primary interaction model is a **guided conversation**, not form-filling or drag-and-drop. The user talks, the AI team listens, questions, and materializes ideas visually.

**Technical Foundation:**

- claudegraph orchestrates the entire session via a `studio-session.graph`
- InteractionNodes pause the graph to present questions and wait for user responses
- LLMNodes generate, refine, and review diagram content
- The graph routes dynamically based on user intent (generate, modify, review, expand)

### 2. Multi-Persona AI Team (BMAD-Powered)

The AI is not monolithic. It manifests as **distinct expert personas** with unique communication styles, expertise domains, and perspectives. This is powered by BMAD party mode, invoked natively through Claude CLI within the claudegraph.

**Personas for Product Design Studio:**

| Internal Agent      | Studio Persona     | Role                                               |
| ------------------- | ------------------ | -------------------------------------------------- |
| PM (John)           | Product Strategist | Challenges the "why", prioritizes features         |
| Architect (Winston) | System Designer    | Validates technical feasibility, proposes patterns |
| UX Designer (Sally) | User Advocate      | Thinks about the end user, interaction design      |
| QA (Quinn)          | Devil's Advocate   | Hunts edge cases, failure modes, risks             |
| Analyst (Mary)      | Domain Analyst     | Brings market/domain context and research          |

**Key Behaviors:**

- 2-3 personas respond per turn, selected based on topic relevance
- Personas reference each other naturally ("As the System Designer mentioned...")
- Personas remember previous conversations within the workspace (via BMAD session memories)
- Users can @mention specific personas

### 3. BMAD Session Isolation (Per User x Per Project)

Each workspace has its own **isolated BMAD environment** — configuration, memories, active agents, and output. This enables:

- **Persistent project memory**: Personas remember decisions, architectural choices, and context
- **Customizable expert teams**: A fintech project activates a Compliance Expert; a healthcare project activates a Patient Safety Analyst
- **Session encapsulation**: All BMAD artifacts (config, memories, output) are scoped to the workspace

**Storage Architecture (V1):**

```
data/sessions/{workspaceId}/
├── _bmad/
│   ├── _memory/
│   │   ├── config.yaml              ← workspace-specific BMAD config
│   │   ├── pm-sidecar/              ← PM persona memories for this project
│   │   ├── architect-sidecar/       ← Architect memories
│   │   └── ...
│   ├── _config/
│   │   └── agent-manifest.csv       ← active agents for this workspace
│   └── agents/                      ← custom agents (future)
├── _bmad-output/
│   ├── diagrams/
│   ├── specs/
│   └── ...
└── session-state.json               ← graph state, conversation history
```

- **DB (Prisma)**: Session metadata (workspace, active agents, last activity, state)
- **Filesystem**: BMAD files (config, memories, output) — required by Claude CLI
- **Future (V2+)**: S3 sync for inactive session depopulation with on-demand rehydration

### 4. JSON-First Data Model

The JsonGraph is the **source of truth** for diagram structure. Mermaid is a **rendering format**, not an editing format.

```
User Intent → AI generates/patches JsonGraph → json2mermaid renders Mermaid → SVG display
```

This enables:

- **Incremental patches**: Add/remove/modify individual nodes and edges without regenerating the entire diagram
- **Patch animations**: Frontend can animate each change (fade in, fade out, transitions)
- **Undo/redo**: Per-node-level history
- **Traceability**: Reviews, specs, and stories reference specific nodes by ID

**Patch Format:**

```json
{
  "addNodes": [{ "id": "error_payment", "label": "Payment Error" }],
  "removeNodes": [],
  "addEdges": [{ "from": "payment", "to": "error_payment", "label": "Card declined" }],
  "removeEdges": [],
  "modifyNodes": [{ "id": "checkout", "label": "Checkout (Updated)" }]
}
```

### 5. Canvas Spatial Layout (V2)

The V1 split-view (chat left, diagram right) is designed to evolve into a **free-form canvas** where all artifacts are positioned spatially:

- Conversations, diagrams, review annotations, spec cards, story cards — all as positioned artifacts
- Visual connections between related artifacts
- The data model supports this from V1 via artifact positioning metadata

**V1 → V2 Transition:**

- V1: Artifacts have slot positions (`left`, `right`)
- V2: Artifacts have free `{ x, y, width, height }` positions
- Same data model, different renderer

## claudegraph Architecture

### Graph Inventory

| Graph                  | Purpose                                                             | Priority |
| ---------------------- | ------------------------------------------------------------------- | -------- |
| `studio-session.graph` | Main session orchestrator with InteractionNodes and refinement loop | P0       |
| `generate-flow.graph`  | Generate diagram from conversational context (exists, to enhance)   | P0       |
| `refine-flow.graph`    | Apply incremental JSON patches from user instructions               | P0       |
| `live-review.graph`    | Micro-annotations on nodes (severity badges)                        | P1       |
| `suggest.graph`        | Ghost node suggestions (semi-transparent proposals)                 | P2       |
| `onboarding.graph`     | Initial context gathering (may be part of studio-session)           | P0       |

### Studio Session Graph (Conceptual Flow)

```
[parse-user-input (FnNode)]
  → [select-personas (FnNode)] — reads manifest, picks 2-3 relevant agents
  → [multi-persona-respond (LLMNode)] — Claude CLI with /bmad-party-mode + workspace context
      Schema: { responses[], diagramReady, diagram?, questionForUser? }
  → [present-to-user (InteractionNode)] — displays persona responses, waits for input
  → [route (FnNode)]
      → user wants to modify → [refine (LLMNode)] → [present-diagram (InteractionNode)] → loop
      → diagramReady → [convert-to-mermaid (FnNode)] → [present-diagram (InteractionNode)]
      → user asks question → loop to multi-persona-respond
      → user validates → [persist (FnNode)] → END
```

### Integration with Docker

- `node:20-slim` base image with Claude CLI installed globally
- BMAD files accessible via volume mount (`.:/app` already includes `_bmad/`)
- Claude CLI spawned by claudegraph with CWD pointing to workspace session directory
- `.credentials.json` mounted for authentication
- `serverExternalPackages: ['claudegraph']` in Next.js config

## Communication Protocol

### Frontend ↔ Graph Communication

**Server-Sent Events (SSE)** for real-time streaming:

```
{ event: 'persona-message', data: { persona: 'pm', name: 'Product Strategist', icon: '📋', message: '...' } }
{ event: 'interaction', data: { question: '...', inputType: 'text' | 'choice', options?: [...] } }
{ event: 'diagram-update', data: { patch: { addNodes: [...], addEdges: [...] } } }
{ event: 'diagram-full', data: { jsonGraph: {...}, mermaidSyntax: '...' } }
{ event: 'review-annotation', data: { nodeId: '...', severity: 'high', message: '...' } }
{ event: 'session-end', data: { summary: '...' } }
```

## V1 Scope (MVP)

### P0 — Core "Wow" Experience

1. **Studio Layout**: Split-view with conversation panel (left) and diagram preview (right)
2. **Onboarding Conversation**: AI guides the user from vague idea to structured flow
3. **Multi-Persona Responses**: BMAD party mode personas respond with distinct styles
4. **Diagram Generation**: Flow appears progressively from conversation context
5. **Iterative Refinement**: "Add X", "Modify Y", "Remove Z" via chat with JSON patches
6. **Live Preview**: Mermaid rendered in real-time with patch animations

### P1 — Enhanced Experience

7. **Live Review Indicators**: Colored badges on nodes (severity-based)
8. **Node Click Actions**: Contextual menu on diagram nodes (Expand, Question, Simplify)
9. **Session Persistence**: BMAD memories persist between conversations

### P2 — Completeness

10. **Ghost Nodes**: Semi-transparent AI suggestions, accept/dismiss with click
11. **Spec Generation from Studio**: Generate stories/specs linked to diagram nodes
12. **Export**: Markdown export of full studio session (diagram + specs + conversation summary)

## Naming & Positioning

- **Product Name**: ProductOS
- **Feature Name**: "Product Design Studio" (not "Diagram Editor")
- **Tagline**: "From idea to backlog in one conversation"
- **The diagram is an artifact of the studio, not the product itself**

## Evolution Roadmap

| Phase        | Focus                       | Key Capability                                        |
| ------------ | --------------------------- | ----------------------------------------------------- |
| V1 (Current) | Conversational Flow Design  | Talk to AI team → get a validated diagram             |
| V2           | Canvas Spatial Layout       | Free-form canvas with positioned, connected artifacts |
| V3           | Custom Personas & Templates | Industry-specific expert teams, flow templates        |
| V4           | Collaboration               | Multi-user canvas, real-time co-design                |
| V5           | Platform                    | API for custom integrations, plugin ecosystem         |
