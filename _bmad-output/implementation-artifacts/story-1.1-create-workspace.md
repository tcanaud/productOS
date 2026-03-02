# Story 1.1: Create and Manage Workspace

Status: ready-for-dev

## Story

As a Product Manager,
I want to create a named workspace with a description,
so that I can centralize all product design artifacts in one place.

## Acceptance Criteria

1. Workspace creation completes in < 30s with name + description (AC:1)
2. PM is set as owner with full permissions on creation (AC:2)
3. Dashboard lists all user workspaces with name, description, last modified (AC:3)
4. Workspace interior shows dashboard of linked artifacts (AC:4)

## Tasks / Subtasks

- [ ] Task 1: Verify database schema from Story 0.1 (AC: 1, 2)
  - [ ] Confirm `Workspace` and `WorkspaceMember` models from Story 0.1 are correct for workspace needs
  - [ ] Add any missing fields if needed (description length, etc.)
  - [ ] Run migration if schema was adjusted
- [ ] Task 2: Workspace API endpoints (AC: 1, 2, 3)
  - [ ] POST /api/workspaces — create workspace
  - [ ] GET /api/workspaces — list user workspaces
  - [ ] GET /api/workspaces/:id — get workspace details
  - [ ] PATCH /api/workspaces/:id — update workspace
  - [ ] DELETE /api/workspaces/:id — delete workspace
- [ ] Task 3: Workspace dashboard page (AC: 3)
  - [ ] Workspace list component with cards (name, description, last modified)
  - [ ] "New Workspace" button + creation modal
  - [ ] Empty state for new users
- [ ] Task 4: Workspace interior page (AC: 4)
  - [ ] Artifact dashboard layout (diagrams, specs, chat sessions)
  - [ ] Navigation sidebar
  - [ ] Placeholder sections for future artifact types
- [ ] Task 5: Tests (AC: 1-4)
  - [ ] Unit tests for workspace API
  - [ ] Integration test: create → list → view flow
  - [ ] Performance test: creation < 30s

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

### Debug Log References

### Completion Notes List

### File List
