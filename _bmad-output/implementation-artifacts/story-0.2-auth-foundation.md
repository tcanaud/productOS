# Story 0.2: Authentication Foundation

Status: ready-for-dev

## Story

As a Product Manager,
I want to log in securely to access my workspaces,
so that my product data is protected and scoped to my account.

## Acceptance Criteria

1. Unauthenticated users are redirected to login page on any protected route (AC:1)
2. Users can register with email + password and are redirected to dashboard (AC:2)
3. Users can log in with email + password and a session is created (AC:3)
4. API middleware validates session and provides user context to all endpoints (AC:4)
5. Users can sign out, session is destroyed (AC:5)
6. Protected API routes return 401 for unauthenticated requests (AC:6)

## Tasks / Subtasks

- [ ] Task 1: NextAuth.js setup (AC: 1, 3, 5)
  - [ ] Install `next-auth` (v5 / Auth.js)
  - [ ] Configure Credentials provider (email + password)
  - [ ] Configure Prisma adapter for session/user storage
  - [ ] Set up session strategy: JWT (simpler for MVP)
  - [ ] Configure `NEXTAUTH_SECRET` and `NEXTAUTH_URL` env vars
  - [ ] Create `src/lib/auth.ts` — auth configuration export
- [ ] Task 2: User registration (AC: 2)
  - [ ] POST /api/auth/register — create user endpoint
  - [ ] Password hashing with bcrypt
  - [ ] Email uniqueness validation
  - [ ] Auto-login after registration (create session)
  - [ ] Input validation (email format, password min length 8)
- [ ] Task 3: Login page UI (AC: 1, 3)
  - [ ] `/src/app/(auth)/login/page.tsx` — login form
  - [ ] Email + password fields
  - [ ] Error messages (invalid credentials, validation errors)
  - [ ] Link to registration page
  - [ ] Redirect to dashboard on success
- [ ] Task 4: Registration page UI (AC: 2)
  - [ ] `/src/app/(auth)/register/page.tsx` — registration form
  - [ ] Name, email, password, confirm password fields
  - [ ] Client-side validation
  - [ ] Error messages (email taken, password mismatch)
  - [ ] Link to login page
  - [ ] Redirect to dashboard on success
- [ ] Task 5: Auth middleware (AC: 4, 6)
  - [ ] Create `src/middleware.ts` — Next.js middleware for route protection
  - [ ] Define public routes: `/login`, `/register`, `/api/auth/*`
  - [ ] All other routes require valid session
  - [ ] Create `src/lib/auth-utils.ts` — helper to get current user in API routes
  - [ ] `getCurrentUser()` — returns user from session or throws 401
- [ ] Task 6: Sign out (AC: 5)
  - [ ] Sign out button in header (will be used by Story 0.3 app shell)
  - [ ] Calls NextAuth signOut()
  - [ ] Redirects to login page
- [ ] Task 7: Tests (AC: 1-6)
  - [ ] Unit tests: registration validation (email format, password strength)
  - [ ] Unit tests: password hashing
  - [ ] Integration test: register → login → access protected route
  - [ ] Integration test: unauthenticated → redirect to login
  - [ ] Integration test: API 401 on missing session

## Dev Notes

- **Depends on Story 0.1** — needs Prisma User model and Next.js project
- Use NextAuth v5 (Auth.js) — better App Router support
- JWT session strategy for MVP (no database session table needed)
- Password requirements for MVP: min 8 characters (keep it simple)
- The User model from Story 0.1 already has `email`, `name`, `password` fields
- Auth group route: `(auth)` layout without app shell (login/register are standalone pages)
- Do NOT implement OAuth/SSO for MVP — email/password only
- `getCurrentUser()` pattern used by every subsequent API route

### Project Structure Notes

- `/src/app/(auth)/login/page.tsx` — login page
- `/src/app/(auth)/register/page.tsx` — register page
- `/src/app/(auth)/layout.tsx` — minimal auth layout (no sidebar)
- `/src/lib/auth.ts` — NextAuth configuration
- `/src/lib/auth-utils.ts` — getCurrentUser() helper
- `/src/middleware.ts` — route protection middleware
- `/src/app/api/auth/register/route.ts` — registration endpoint
- `/src/app/api/auth/[...nextauth]/route.ts` — NextAuth API routes

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0 — Story 0.2]
- [Source: PRD#Security — RBAC, SSO ready]
- [Source: Story 0.1 — Prisma User model dependency]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
