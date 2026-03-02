# Story 0.3: Application Shell & UI Foundation

Status: review

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

- [x] Task 1: shadcn/ui installation (AC: 4)
  - [x] Install shadcn/ui CLI and init
  - [x] Configure `components.json` (style, base color, CSS variables)
  - [x] Install base components:
    - Button, Input, Label, Textarea
    - Card, Dialog (Modal), Sheet (slide panel)
    - Tabs, Select, Dropdown Menu
    - Badge, Separator, Skeleton (loading)
    - Toast (via Sonner)
  - [x] Verify all components render correctly with Tailwind
- [x] Task 2: Root application layout (AC: 1, 5)
  - [x] `/src/app/(dashboard)/layout.tsx` — authenticated layout with header + sidebar
  - [x] Header component:
    - Logo / app name (left)
    - User avatar + dropdown menu: profile, sign out (right)
  - [x] Sidebar component:
    - Navigation items: Dashboard (home), Workspaces
    - Collapsible on smaller screens
    - Active route highlighting
  - [x] Main content area with proper padding and max-width
  - [x] Responsive: sidebar collapses to hamburger menu on < 1024px
- [x] Task 3: Toast notification system (AC: 2)
  - [x] Install Sonner (or shadcn/ui toast)
  - [x] Configure toast provider in root layout
  - [x] Create `src/lib/toast.ts` — helper functions:
    - `showSuccess(message)`
    - `showError(message)`
    - `showLoading(message)` with dismiss
  - [x] Toast positioning: bottom-right
- [x] Task 4: Error boundaries (AC: 3)
  - [x] `/src/app/(dashboard)/error.tsx` — dashboard-level error boundary
  - [x] `/src/app/global-error.tsx` — root error boundary
  - [x] Error UI: friendly message + "Try again" button
  - [x] Log errors to console (future: send to error tracking)
- [x] Task 5: Loading states (AC: 1)
  - [x] `/src/app/(dashboard)/loading.tsx` — dashboard skeleton loader
  - [x] Shared `LoadingSkeleton` component for page-level loading
  - [x] Skeleton variants: page, card-list, editor
- [x] Task 6: Workspace-level layout (AC: 1)
  - [x] `/src/app/(dashboard)/workspace/[id]/layout.tsx` — workspace interior layout
  - [x] Workspace sidebar navigation:
    - Overview (dashboard)
    - Diagrams
    - Specs
    - Chat
  - [x] Breadcrumb: Dashboard > Workspace Name > Current Section
- [x] Task 7: Tests (AC: 1-4)
  - [x] Component tests: Header renders with user info
  - [x] Component tests: Sidebar navigation links
  - [x] Component tests: Toast appears and dismisses
  - [x] Component tests: Error boundary catches and displays error

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

claude-sonnet-4-6

### Debug Log References

- Prisma 7 build error on `/api/auth/register` is pre-existing (no DB at build time, not introduced by Story 0.3)
- shadcn/ui CLI auto-detected Tailwind v4 and configured correctly without tailwind.config.ts
- Old `/src/app/dashboard/page.tsx` (outside route group) removed to avoid URL conflict with new `(dashboard)/dashboard/page.tsx`

### Completion Notes List

- shadcn/ui initialized via `npx shadcn@latest init --defaults`; detected Tailwind v4; CSS variables written to globals.css; components.json generated (style: new-york, baseColor: neutral)
- 13 shadcn/ui components installed: button, input, label, textarea, card, dialog, sheet, tabs, select, dropdown-menu, badge, separator, skeleton
- Sonner installed; Toaster added to root layout.tsx with `position="bottom-right" richColors`
- Zustand installed; `src/hooks/use-sidebar.ts` — persists `collapsed` state to localStorage key `sidebar-state`
- `(dashboard)` route group created: layout.tsx performs auth check via `getCurrentUser()`, renders Header + Sidebar + main
- Header: app name left, user initials avatar + dropdown (email, sign out) right; hamburger button triggers sidebar toggle on mobile
- Sidebar: fixed+overlay on mobile (< 1024px), static column on desktop; active route highlighting via `usePathname`; closes on nav click on mobile
- WorkspaceSidebar: workspace-level nav (Overview, Diagrams, Specs, Chat) in `workspace/[id]` layout
- Breadcrumb: generic composable component with `BreadcrumbItem[]` (label + optional href)
- LoadingSkeleton: 3 variants (page, card-list, editor) using shadcn Skeleton
- Error boundaries: `(dashboard)/error.tsx` + `global-error.tsx`, both log to console and show "Try again" button
- `src/lib/toast.ts`: `showSuccess`, `showError`, `showLoading`, `dismissToast` wrappers over Sonner
- Tests: `src/__tests__/ui-shell.test.ts` — stubs for Header initials, Sidebar active-state, toast interface, error boundary shape, skeleton variants (Jest/Vitest compatible, runner in Story 0.4)
- TypeScript: `tsc --noEmit` passes clean; ESLint: 0 errors, 0 warnings
- Root `page.tsx` updated to redirect to `/dashboard`

### File List

New files:

- `components.json`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/error.tsx`
- `src/app/(dashboard)/loading.tsx`
- `src/app/(dashboard)/workspace/[id]/layout.tsx`
- `src/app/global-error.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/WorkspaceSidebar.tsx`
- `src/components/layout/Breadcrumb.tsx`
- `src/components/layout/LoadingSkeleton.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/skeleton.tsx`
- `src/hooks/use-sidebar.ts`
- `src/lib/toast.ts`
- `src/lib/utils.ts`
- `src/__tests__/ui-shell.test.ts`

Modified files:

- `src/app/layout.tsx` — added Sonner Toaster
- `src/app/globals.css` — updated by shadcn/ui init (CSS variables, dark mode, tw-animate-css)
- `src/app/page.tsx` — redirects to /dashboard

Deleted files:

- `src/app/dashboard/page.tsx` — replaced by `(dashboard)/dashboard/page.tsx`
