# Story 2.1: Edit Mermaid Diagrams

Status: ready-for-dev

## Story

As a Product Manager,
I want to create and edit Mermaid diagrams in a text editor with live visual preview,
so that I can model my product flows visually.

## Acceptance Criteria

1. Monaco editor opens with Mermaid syntax highlighting when creating a new diagram (AC:1)
2. Live preview renders in real-time < 500ms on valid Mermaid input (AC:2)
3. Diagram autosaves every 5s (AC:3)
4. Version history is maintained for each diagram (AC:4)

## Tasks / Subtasks

- [ ] Task 1: Database schema for diagrams (AC: 3, 4)
  - [ ] Create `diagrams` table (id, workspace_id, title, content, diagram_type, created_at, updated_at)
  - [ ] Create `diagram_versions` table (id, diagram_id, content, author_id, timestamp, diff)
  - [ ] Add migration scripts
- [ ] Task 2: Diagram API endpoints (AC: 3, 4)
  - [ ] POST /api/workspaces/:id/diagrams — create diagram
  - [ ] GET /api/workspaces/:id/diagrams — list diagrams
  - [ ] GET /api/diagrams/:id — get diagram with content
  - [ ] PATCH /api/diagrams/:id — update diagram content
  - [ ] GET /api/diagrams/:id/versions — get version history
  - [ ] POST /api/diagrams/:id/versions/:vid/restore — restore version
- [ ] Task 3: Monaco editor integration (AC: 1)
  - [ ] Install and configure @monaco-editor/react
  - [ ] Add Mermaid language support (syntax highlighting)
  - [ ] Configure editor defaults (font, theme, minimap off)
- [ ] Task 4: Mermaid live preview (AC: 2)
  - [ ] Install mermaid.js library
  - [ ] Split-pane layout: editor left, preview right
  - [ ] Debounced render on keystroke (< 500ms)
  - [ ] Error state display for invalid syntax
- [ ] Task 5: Autosave mechanism (AC: 3)
  - [ ] Implement 5s interval autosave with dirty check
  - [ ] Visual indicator: "Saved" / "Saving..." / "Unsaved changes"
  - [ ] Debounce to avoid saving during rapid typing
- [ ] Task 6: Version history UI (AC: 4)
  - [ ] Version history sidebar/panel
  - [ ] Diff view between versions
  - [ ] Restore to previous version with confirmation
- [ ] Task 7: Tests (AC: 1-4)
  - [ ] Unit tests for diagram API
  - [ ] Unit tests for autosave logic
  - [ ] Integration test: create → edit → autosave → verify version

## Dev Notes

- Monaco Editor: use `@monaco-editor/react` (well-maintained React wrapper)
- Mermaid: use `mermaid` npm package (v11+) for rendering
- Split pane: `react-resizable-panels` or similar
- Autosave: use `useInterval` + dirty flag pattern, NOT on every keystroke
- Version diff: store full content per version for MVP; optimize to diffs later
- Diagram types supported for MVP: flowchart, stateDiagram, sequenceDiagram

### Project Structure Notes

- `/src/app/(dashboard)/workspace/[id]/diagram/[diagramId]/` — diagram editor page
- `/src/components/diagram/MonacoMermaidEditor.tsx` — editor component
- `/src/components/diagram/MermaidPreview.tsx` — preview renderer
- `/src/components/diagram/VersionHistory.tsx` — version panel
- `/src/hooks/useAutosave.ts` — autosave hook
- `/src/lib/mermaid/` — Mermaid configuration and helpers

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2]
- [Source: PRD#Feature 2 — Diagram Engine]
- [Source: Architecture#Frontend Architecture — Diagram Editor]
- [Source: Story 1.1 — Workspace must exist for diagram context (dependency)]
- [Source: Story 0.3 — App shell workspace layout ((dashboard)/workspace/[id]/ route group)]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
