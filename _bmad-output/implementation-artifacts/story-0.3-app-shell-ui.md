# Story 0.3: Application Shell & UI Foundation

Status: ready-for-dev

## Story

As a Developer,
I want a shared application shell with layout, navigation, and base UI components,
so that all feature pages have consistent UX and shared infrastructure.

## Acceptance Criteria

1. Authenticated pages display consistent layout: header (logo, user menu) + sidebar navigation (AC:1)
2. Toast notification system provides user feedback on operations (AC:2)
3. Error boundaries catch component errors gracefully without full app crash (AC:3)
4. Base UI components (buttons, inputs, cards, modals, tabs, dropdowns) available via shadcn/ui (AC:4)
5. Responsive layout works on desktop (1024px+) (AC:5)

## Tasks / Subtasks

- [ ] Task 1: shadcn/ui installation (AC: 4)
  - [ ] Install shadcn/ui CLI and init
  - [ ] Configure `components.json` (style, base color, CSS variables)
  - [ ] Install base components:
    - Button, Input, Label, Textarea
    - Card, Dialog (Modal), Sheet (slide panel)
    - Tabs, Select, Dropdown Menu
    - Badge, Separator, Skeleton (loading)
    - Toast (via Sonner)
  - [ ] Verify all components render correctly with Tailwind
- [ ] Task 2: Root application layout (AC: 1, 5)
  - [ ] `/src/app/(dashboard)/layout.tsx` — authenticated layout with header + sidebar
  - [ ] Header component:
    - Logo / app name (left)
    - User avatar + dropdown menu: profile, sign out (right)
  - [ ] Sidebar component:
    - Navigation items: Dashboard (home), Workspaces
    - Collapsible on smaller screens
    - Active route highlighting
  - [ ] Main content area with proper padding and max-width
  - [ ] Responsive: sidebar collapses to hamburger menu on < 1024px
- [ ] Task 3: Toast notification system (AC: 2)
  - [ ] Install Sonner (or shadcn/ui toast)
  - [ ] Configure toast provider in root layout
  - [ ] Create `src/lib/toast.ts` — helper functions:
    - `showSuccess(message)`
    - `showError(message)`
    - `showLoading(message)` with dismiss
  - [ ] Toast positioning: bottom-right
- [ ] Task 4: Error boundaries (AC: 3)
  - [ ] `/src/app/(dashboard)/error.tsx` — dashboard-level error boundary
  - [ ] `/src/app/global-error.tsx` — root error boundary
  - [ ] Error UI: friendly message + "Try again" button
  - [ ] Log errors to console (future: send to error tracking)
- [ ] Task 5: Loading states (AC: 1)
  - [ ] `/src/app/(dashboard)/loading.tsx` — dashboard skeleton loader
  - [ ] Shared `LoadingSkeleton` component for page-level loading
  - [ ] Skeleton variants: page, card-list, editor
- [ ] Task 6: Workspace-level layout (AC: 1)
  - [ ] `/src/app/(dashboard)/workspace/[id]/layout.tsx` — workspace interior layout
  - [ ] Workspace sidebar navigation:
    - Overview (dashboard)
    - Diagrams
    - Specs
    - Chat
  - [ ] Breadcrumb: Dashboard > Workspace Name > Current Section
- [ ] Task 7: Tests (AC: 1-4)
  - [ ] Component tests: Header renders with user info
  - [ ] Component tests: Sidebar navigation links
  - [ ] Component tests: Toast appears and dismisses
  - [ ] Component tests: Error boundary catches and displays error

## Dev Notes

- **Depends on Story 0.1 (Tailwind) + Story 0.2 (auth — user context for header)**
- shadcn/ui is the right choice: accessible, customizable, no runtime dependency
- Use Sonner for toasts — better DX than shadcn's built-in toast
- Two layout levels:
  1. `(dashboard)/layout.tsx` — main app shell (header + top-level sidebar)
  2. `(dashboard)/workspace/[id]/layout.tsx` — workspace-specific navigation
- Sidebar state (collapsed/expanded) stored in localStorage via Zustand
- Design tokens: use CSS variables via Tailwind for future theme support
- Desktop-first for MVP — no mobile optimization needed

### Project Structure Notes

- `/src/app/(dashboard)/layout.tsx` — main authenticated layout
- `/src/app/(dashboard)/workspace/[id]/layout.tsx` — workspace layout
- `/src/app/(dashboard)/error.tsx` — error boundary
- `/src/app/(dashboard)/loading.tsx` — loading skeleton
- `/src/components/layout/Header.tsx` — app header
- `/src/components/layout/Sidebar.tsx` — main sidebar
- `/src/components/layout/WorkspaceSidebar.tsx` — workspace-level sidebar
- `/src/components/layout/Breadcrumb.tsx` — breadcrumb navigation
- `/src/components/ui/` — shadcn/ui components (auto-generated)
- `/src/lib/toast.ts` — toast helpers

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0 — Story 0.3]
- [Source: Architecture#Frontend Architecture — UI Modules]
- [Source: Story 0.2 — auth context dependency for user menu]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
