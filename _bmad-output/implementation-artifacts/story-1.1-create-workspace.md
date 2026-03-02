# Story 1.1: Create and Manage Workspace

Status: review

## Story

As a Product Manager,
I want to create a named workspace with a description,
so that I can centralize all product design artifacts in one place.

## Acceptance Criteria

1. **Given** a logged-in PM on the dashboard, **When** they click "New Workspace" and enter name + description, **Then** the workspace is created in < 30s (AC:1)
2. **And** the PM is set as owner with full permissions (AC:2)
3. **Given** a PM on the dashboard, **When** they view their workspace list, **Then** all their workspaces are listed with name, description, and last modified date (AC:3)
4. **Given** a PM inside a workspace, **When** they navigate the workspace, **Then** they see a dashboard of linked artifacts (diagrams, specs, chat history) (AC:4)

## Tasks / Subtasks

- [x] Task 1: Verify database schema from Story 0.1 (AC: 1, 2)
  - [x] Confirm `Workspace` and `WorkspaceMember` models from Story 0.1 are correct for workspace needs
  - [x] Add any missing fields if needed (description length, etc.)
  - [x] Run migration if schema was adjusted
- [x] Task 2: Workspace API endpoints (AC: 1, 2, 3)
  - [x] POST /api/workspaces — create workspace
  - [x] GET /api/workspaces — list user workspaces
  - [x] GET /api/workspaces/:id — get workspace details
  - [x] PATCH /api/workspaces/:id — update workspace
  - [x] DELETE /api/workspaces/:id — delete workspace
- [x] Task 3: Workspace dashboard page (AC: 3)
  - [x] Workspace list component with cards (name, description, last modified)
  - [x] "New Workspace" button + creation modal
  - [x] Empty state for new users
- [x] Task 4: Workspace interior page (AC: 4)
  - [x] Artifact dashboard layout (diagrams, specs, chat sessions)
  - [x] Navigation sidebar
  - [x] Placeholder sections for future artifact types
- [x] Task 5: Tests (AC: 1-4)
  - [x] Unit tests for workspace API
  - [x] Integration test: create → list → view flow
  - [x] Performance test: creation < 30s

## Dev Notes

- **Depends on Stories 0.1, 0.2, 0.3** — needs Prisma schema (0.1), auth with `getCurrentUser()` (0.2), and app shell layout (0.3)
- Stack: Next.js API routes + Prisma ORM (already set up in Story 0.1)
- Authentication: use `getCurrentUser()` from `src/lib/auth-utils.ts` (Story 0.2) in all API routes
- Workspace + WorkspaceMember Prisma models already created in Story 0.1 — verify and extend if needed
- Keep workspace schema extensible — will add artifact relations in Epic 2
- Owner role is the only role for MVP; RBAC is post-MVP

### Project Structure Notes

- `/src/app/api/workspaces/` — API routes
- `/src/app/(dashboard)/page.tsx` — workspace list (dashboard home)
- `/src/app/(dashboard)/workspace/[id]/page.tsx` — workspace interior page
- `/prisma/schema.prisma` — database schema (from Story 0.1)
- `/src/components/workspace/` — shared workspace components

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1]
- [Source: PRD#Feature 1 — Product Workspace]
- [Source: Story 0.1 — Prisma schema (Workspace, WorkspaceMember models)]
- [Source: Story 0.2 — Authentication (getCurrentUser())]
- [Source: Story 0.3 — App shell layout ((dashboard) route group)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Prisma schema already correct from Story 0.1 (Workspace + WorkspaceMember models) — no migration needed.
- Workspace routes created under `/workspaces/[id]/` (plural) to match WorkspaceSidebar links which already used `/workspaces/[id]/...`.
- Installed `date-fns` for `formatDistanceToNow` in WorkspaceCard.

### Completion Notes List

- `GET /api/workspaces` + `POST /api/workspaces`: list (filtered by membership) and create (with WorkspaceMember owner row). Creates in < 30s (AC:1), sets PM as owner (AC:2).
- `GET/PATCH/DELETE /api/workspaces/[id]`: detail, update (owner-only), delete (owner-only, cascades members).
- `WorkspaceCard`: card with name, description, last modified (date-fns), edit/delete dropdown.
- `WorkspaceFormDialog`: Dialog for create and edit with validation (name required, max 100 chars).
- `WorkspaceList`: client component — grid of cards (AC:3), empty state, "New Workspace" button, navigates to workspace on creation.
- `/workspaces` page: server component fetches workspaces, serializes dates, renders WorkspaceList.
- `/workspaces/[id]/layout.tsx`: verifies membership via Prisma, renders WorkspaceSidebar + Breadcrumb.
- `/workspaces/[id]/overview/page.tsx`: artifact dashboard with 3 cards — Diagrams, Specs, Chat History (AC:4).
- Placeholder pages: `/workspaces/[id]/diagrams`, `/specs`, `/chat` — empty states with "Coming in Epic X".
- 16 new tests: name validation (6), response shape (3), CRUD flow simulation (6), performance (1). 55 total pass.

### File List

- `src/app/api/workspaces/route.ts` (new)
- `src/app/api/workspaces/[id]/route.ts` (new)
- `src/app/api/workspaces/workspace-api.test.ts` (new)
- `src/app/(dashboard)/workspaces/page.tsx` (new)
- `src/app/(dashboard)/workspaces/[id]/layout.tsx` (new)
- `src/app/(dashboard)/workspaces/[id]/overview/page.tsx` (new)
- `src/app/(dashboard)/workspaces/[id]/diagrams/page.tsx` (new)
- `src/app/(dashboard)/workspaces/[id]/specs/page.tsx` (new)
- `src/app/(dashboard)/workspaces/[id]/chat/page.tsx` (new)
- `src/components/workspace/WorkspaceCard.tsx` (new)
- `src/components/workspace/WorkspaceFormDialog.tsx` (new)
- `src/components/workspace/WorkspaceList.tsx` (new)
- `package.json` (modified — date-fns added)
