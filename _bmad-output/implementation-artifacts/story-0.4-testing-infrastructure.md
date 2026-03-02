# Story 0.4: Testing Infrastructure

Status: ready-for-dev

## Story

As a Developer,
I want a configured testing framework with utilities and mocks,
so that I can write and run tests for every story without setup overhead.

## Acceptance Criteria

1. `npm test` runs Vitest with unit and integration tests (AC:1)
2. React Testing Library is configured for component tests (AC:2)
3. Mock fixtures for Claude API responses are available (AC:3)
4. Test database setup with automatic setup/teardown works (AC:4)
5. GitHub Actions CI pipeline runs all tests on push/PR (AC:5)

## Tasks / Subtasks

- [ ] Task 1: Vitest setup (AC: 1)
  - [ ] Install vitest, @vitejs/plugin-react
  - [ ] Configure `vitest.config.ts`:
    - Environment: jsdom (for component tests)
    - Path aliases matching tsconfig
    - Coverage configuration (v8 provider)
    - Test file patterns: `**/*.test.ts`, `**/*.test.tsx`
  - [ ] Add scripts to package.json:
    - `test` — vitest run
    - `test:watch` — vitest (watch mode)
    - `test:coverage` — vitest run --coverage
  - [ ] Create `src/test/setup.ts` — global test setup
- [ ] Task 2: React Testing Library (AC: 2)
  - [ ] Install @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
  - [ ] Configure jest-dom matchers in test setup
  - [ ] Create `src/test/render.tsx` — custom render with providers:
    - Session provider (mocked)
    - Toast provider
    - Any other global providers
  - [ ] Create example component test to verify setup works
- [ ] Task 3: API test utilities (AC: 1)
  - [ ] Create `src/test/api-helpers.ts`:
    - `createMockRequest(method, body, headers)` — mock NextRequest
    - `createMockSession(user)` — mock authenticated session
    - `parseResponse(response)` — extract JSON from NextResponse
  - [ ] Create `src/test/factories.ts` — test data factories:
    - `createTestUser(overrides?)` — User factory
    - `createTestWorkspace(overrides?)` — Workspace factory
    - `createTestDiagram(overrides?)` — Diagram factory
- [ ] Task 4: Claude API mock fixtures (AC: 3)
  - [ ] Create `src/test/mocks/claude.ts`:
    - Mock Anthropic client class
    - Pre-built response fixtures:
      - `mockFlowGenerationResponse` — JSON graph for diagram gen
      - `mockReviewResponse` — structured review output
      - `mockSpecGenerationResponse` — PRD/stories output
      - `mockChatResponse` — multi-persona chat response
    - `mockClaudeError(type)` — rate limit, timeout, invalid response
  - [ ] Create `src/test/mocks/handlers.ts` — MSW-style mock if needed
  - [ ] Document mock usage in README or test README
- [ ] Task 5: Test database (AC: 4)
  - [ ] Create `.env.test` with test DATABASE_URL (separate test DB)
  - [ ] Create `src/test/db.ts`:
    - `setupTestDB()` — run migrations on test DB
    - `teardownTestDB()` — clear all tables
    - `seedTestDB()` — insert minimal test data
  - [ ] Configure Vitest globalSetup for DB lifecycle
  - [ ] Add Docker Compose service for test DB (or use same Postgres with different DB name)
- [ ] Task 6: GitHub Actions CI pipeline (AC: 5)
  - [ ] Create `.github/workflows/ci.yml`:
    - Trigger: push to main/devel, pull requests
    - Steps:
      1. Checkout
      2. Setup Node.js 20
      3. Install dependencies (npm ci)
      4. Lint (eslint)
      5. Type check (tsc --noEmit)
      6. Start test Postgres (service container)
      7. Run migrations
      8. Run tests with coverage
    - PostgreSQL service container with pgvector
  - [ ] Add CI badge to README
- [ ] Task 7: Verification (AC: 1-5)
  - [ ] Write and run 1 example unit test (utility function)
  - [ ] Write and run 1 example component test (renders a button)
  - [ ] Write and run 1 example API test (mock endpoint)
  - [ ] Verify CI pipeline passes on push

## Dev Notes

- **Can be done in parallel with Story 0.2 and 0.3**
- Vitest over Jest — faster, native ESM, better DX with Vite
- React Testing Library — standard for React component testing
- Claude API mocks are critical — we can't run real API calls in tests (cost + flakiness)
- Test DB: simplest approach is a second database in the same Postgres instance
  - `productos_test` alongside `productos` in docker-compose
- CI pipeline should be minimal but functional:
  - Lint + typecheck + test on every PR
  - No deployment (not yet)
- Coverage target: don't enforce percentage for MVP, but track it
- MSW (Mock Service Worker) is optional — direct mock injection may be simpler for MVP

### Project Structure Notes

- `/vitest.config.ts` — test configuration
- `/src/test/setup.ts` — global test setup
- `/src/test/render.tsx` — custom render with providers
- `/src/test/api-helpers.ts` — API test utilities
- `/src/test/factories.ts` — test data factories
- `/src/test/db.ts` — test database lifecycle
- `/src/test/mocks/claude.ts` — Claude API mock fixtures
- `/.github/workflows/ci.yml` — CI pipeline

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0 — Story 0.4]
- [Source: PRD#NFR — Performance targets requiring benchmarks]
- [Source: Architecture#AI Orchestrator — needs mock strategy]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
