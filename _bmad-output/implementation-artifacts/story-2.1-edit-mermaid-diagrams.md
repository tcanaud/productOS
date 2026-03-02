# Story 2.1: Edit Mermaid Diagrams

Status: review

## Story

As a Product Manager,
I want to create and edit Mermaid diagrams in a text editor with live visual preview,
so that I can model my product flows visually.

## Acceptance Criteria

1. Given a PM inside a workspace, when they create a new diagram, then a Monaco editor opens with Mermaid syntax highlighting (AC:1)
2. Given a PM editing Mermaid code, when they type valid Mermaid syntax, then a live preview renders in real-time (< 500ms) (AC:2)
3. Given a PM editing a diagram, when changes are made, then the diagram is autosaved every 5s (AC:3)
4. Given a PM editing a diagram, when changes are made, then version history is maintained (AC:4)

## Tasks / Subtasks

- [x] Task 1: Database schema for diagrams (AC: 3, 4)
  - [x] Add `Diagram` model to `prisma/schema.prisma` (id, workspaceId, title, content, diagramType, createdAt, updatedAt)
  - [x] Add `DiagramVersion` model (id, diagramId, content, authorId, createdAt)
  - [x] Add relation `Workspace -> Diagram[]` in schema
  - [x] Run `prisma migrate dev` to generate migration
- [x] Task 2: Diagram API endpoints (AC: 3, 4)
  - [x] `POST /api/workspaces/[id]/diagrams` — create diagram
  - [x] `GET /api/workspaces/[id]/diagrams` — list diagrams in workspace
  - [x] `GET /api/diagrams/[diagramId]` — get diagram with content
  - [x] `PATCH /api/diagrams/[diagramId]` — update diagram content (used by autosave)
  - [x] `GET /api/diagrams/[diagramId]/versions` — list version history
  - [x] `POST /api/diagrams/[diagramId]/versions/[versionId]/restore` — restore a version
  - [x] All endpoints: authenticate with `requireAuth()`, validate with Zod
- [x] Task 3: Monaco editor integration (AC: 1)
  - [x] Install `@monaco-editor/react`
  - [x] Create `src/components/diagram/MonacoMermaidEditor.tsx`
  - [x] Register Mermaid language grammar for syntax highlighting (keywords, comments, arrows)
  - [x] Configure editor defaults: dark theme, no minimap, 14px font, line wrap off
- [x] Task 4: Mermaid live preview (AC: 2)
  - [x] Install `mermaid` (v11+)
  - [x] Create `src/components/diagram/MermaidPreview.tsx`
  - [x] Split-pane layout: editor left, preview right — use `react-resizable-panels`
  - [x] Debounce render on editor change: ≤ 500ms debounce
  - [x] Display error banner for invalid Mermaid syntax (catch render exceptions)
  - [x] Initialize Mermaid with `startOnLoad: false` to control render lifecycle
- [x] Task 5: Autosave mechanism (AC: 3)
  - [x] Create `src/hooks/useAutosave.ts` — custom hook
    - Tracks dirty state (content changed since last save)
    - Triggers PATCH API call every 5s when dirty
    - Debounce: skip save if user typed within last 1s
  - [x] Visual save indicator in editor toolbar: "Saved ✓" / "Saving…" / "Unsaved changes"
  - [x] On component unmount: flush pending save
- [x] Task 6: Version history (AC: 4)
  - [x] Create `src/components/diagram/VersionHistory.tsx` — collapsible side panel
  - [x] List versions with timestamp and author
  - [x] On each autosave, POST a new `DiagramVersion` entry (server-side in PATCH handler)
  - [x] Restore version: confirmation dialog → call restore endpoint → reload editor content
  - [x] Cap version history at 50 entries per diagram (delete oldest on overflow)
- [x] Task 7: Diagram editor page (AC: 1-4)
  - [x] Create page at `/src/app/(dashboard)/workspaces/[id]/diagrams/[diagramId]/page.tsx`
  - [x] Load diagram by ID (server component fetch), pass to client editor
  - [x] "New diagram" button on workspace page → POST create → redirect to editor
  - [x] Breadcrumb: Workspace → Diagram title (editable inline)
- [x] Task 8: Tests (AC: 1-4)
  - [x] Unit tests for diagram API routes (create, update, list, restore)
  - [x] Unit tests for `useAutosave` hook (dirty flag, 5s trigger, debounce)
  - [x] Integration test: create diagram → edit content → verify autosave → verify version created

## Dev Notes

- **Dependency**: Story 1.1 (workspace must exist), Story 0.3 (app shell route group `(dashboard)/workspace/[id]/`)
- **No dependency on Story 2.0** — this story is pure editor + persistence, no AI calls
- Monaco: use dynamic import (`next/dynamic` with `ssr: false`) — Monaco does not support SSR
- Mermaid: also requires `ssr: false`; call `mermaid.initialize()` once in a `useEffect`
- Split pane: `react-resizable-panels` — persists pane size in localStorage
- Version history: store **full content** per version for MVP (no diff format)
- Supported diagram types for MVP: `flowchart`, `sequenceDiagram`, `stateDiagram`
- Inline title edit: debounced PATCH to same `/api/diagrams/[id]` endpoint

### Project Structure Notes

- `/src/app/(dashboard)/workspaces/[id]/diagrams/[diagramId]/page.tsx` — editor page (server component wrapper)
- `/src/app/api/workspaces/[id]/diagrams/route.ts` — create + list
- `/src/app/api/diagrams/[diagramId]/route.ts` — get + update
- `/src/app/api/diagrams/[diagramId]/versions/route.ts` — list versions
- `/src/app/api/diagrams/[diagramId]/versions/[versionId]/restore/route.ts` — restore
- `/src/components/diagram/MonacoMermaidEditor.tsx` — Monaco wrapper with Mermaid grammar
- `/src/components/diagram/MermaidPreview.tsx` — live preview renderer
- `/src/components/diagram/VersionHistory.tsx` — version history side panel
- `/src/components/diagram/DiagramEditorLayout.tsx` — split-pane client component
- `/src/hooks/useAutosave.ts` — autosave hook

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2]
- [Source: PRD#Feature 2 — Diagram Engine]
- [Source: Story 1.1 — Workspace must exist for diagram context (dependency)]
- [Source: Story 0.3 — App shell workspace layout ((dashboard)/workspace/[id]/ route group)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `prisma migrate dev --create-only` fails without live DB (known pre-existing limitation); migration SQL manually written to `prisma/migrations/20260302000000_add_diagram_models/`; `prisma generate` succeeds and regenerates Prisma client with Diagram and DiagramVersion models
- Monaco and Mermaid both require `ssr: false` dynamic imports — `MonacoMermaidEditor` wrapped in `next/dynamic`, `MermaidPreview` uses `import('mermaid')` inside `useEffect`
- `mermaidInitialized` module-level flag prevents re-initializing Mermaid on every render
- `useAutosave` flush-on-unmount effect intentionally uses empty dep array with a ref for `onSave` to avoid stale closure issues
- Version cap (50): implemented in PATCH handler — counts versions, deletes oldest if exceeded

### Completion Notes List

- `prisma/schema.prisma`: added `Diagram` model (id, workspaceId, title, content, diagramType, createdAt, updatedAt) + `DiagramVersion` model (id, diagramId, content, authorId, createdAt); `Workspace` gains `diagrams Diagram[]` relation; `onDelete: Cascade` on both FK constraints
- `prisma/migrations/20260302000000_add_diagram_models/migration.sql`: manual migration SQL for Diagram + DiagramVersion tables
- `src/app/api/workspaces/[id]/diagrams/route.ts`: POST (create, Zod validated) + GET (list, membership check); returns 404 for non-member workspace access
- `src/app/api/diagrams/[diagramId]/route.ts`: GET (fetch with content) + PATCH (update with autosave version creation + 50-cap enforcement); version created only when content actually changes
- `src/app/api/diagrams/[diagramId]/versions/route.ts`: GET (list versions desc by createdAt)
- `src/app/api/diagrams/[diagramId]/versions/[versionId]/restore/route.ts`: POST (restore content + create new version entry)
- `src/components/diagram/MonacoMermaidEditor.tsx`: Monaco Editor with custom Mermaid language registration (monarch tokenizer); dark theme, 14px, no minimap, SSR-safe dynamic import
- `src/components/diagram/MermaidPreview.tsx`: dynamic `import('mermaid')` in useEffect, `startOnLoad: false`, error banner on invalid syntax, `AlertCircle` icon from lucide
- `src/components/diagram/VersionHistory.tsx`: collapsible panel, version list, two-step confirm for restore, timestamps via `toLocaleString()`
- `src/components/diagram/DiagramEditorLayout.tsx`: `react-resizable-panels` PanelGroup (editor 50% / preview 40% / history 10%), 500ms debounce for preview, `useAutosave` 5s interval, title inline edit with 800ms debounce
- `src/components/diagram/NewDiagramButton.tsx`: client component — POST create → router.push to editor page; default flowchart content
- `src/app/(dashboard)/workspaces/[id]/diagrams/page.tsx`: updated from placeholder to full list page with NewDiagramButton and diagram cards
- `src/app/(dashboard)/workspaces/[id]/diagrams/[diagramId]/page.tsx`: server component, loads diagram from DB, guards with `notFound()`, renders `DiagramEditorLayout`
- `src/hooks/useAutosave.ts`: dirty tracking via ref, 5s interval, 1s debounce guard, flush on unmount, `AutosaveStatus` type exported
- `src/__tests__/diagram-editor.test.ts`: 36 tests — diagram validation (create/update), response shape, version history logic (dirty, cap, restore), autosave simulation (dirty flag, 5s trigger, debounce, error state), live preview debounce, and full lifecycle integration
- All 165 tests pass (36 new + 129 existing); 0 lint errors

### File List

- `prisma/schema.prisma` (modified — Diagram, DiagramVersion models; Workspace diagrams relation)
- `prisma/migrations/20260302000000_add_diagram_models/migration.sql` (created)
- `src/app/api/workspaces/[id]/diagrams/route.ts` (created)
- `src/app/api/diagrams/[diagramId]/route.ts` (created)
- `src/app/api/diagrams/[diagramId]/versions/route.ts` (created)
- `src/app/api/diagrams/[diagramId]/versions/[versionId]/restore/route.ts` (created)
- `src/components/diagram/MonacoMermaidEditor.tsx` (created)
- `src/components/diagram/MermaidPreview.tsx` (created)
- `src/components/diagram/VersionHistory.tsx` (created)
- `src/components/diagram/DiagramEditorLayout.tsx` (created)
- `src/components/diagram/NewDiagramButton.tsx` (created)
- `src/app/(dashboard)/workspaces/[id]/diagrams/page.tsx` (modified — full list page with NewDiagramButton)
- `src/app/(dashboard)/workspaces/[id]/diagrams/[diagramId]/page.tsx` (created)
- `src/hooks/useAutosave.ts` (created)
- `src/__tests__/diagram-editor.test.ts` (created)
- `package.json` (modified — @monaco-editor/react, mermaid, react-resizable-panels added)
- `package-lock.json` (modified)
