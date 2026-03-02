# Test Utilities — productos

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # Run with coverage report
```

## Directory Structure

```
src/test/
├── setup.ts           # Global test setup (@testing-library/jest-dom matchers)
├── render.tsx         # Custom render() with providers (Session, Toaster)
├── api-helpers.ts     # createMockRequest(), createMockSession(), parseResponse()
├── factories.ts       # createTestUser(), createTestWorkspace(), createTestDiagram()
├── db.ts              # setupTestDB(), teardownTestDB(), seedTestDB()
├── README.md          # This file
└── mocks/
    ├── claude.ts      # Claude API mock fixtures and mock client
    └── handlers.ts    # fetch mock handler factory
```

## Claude API Mocks

Use these when testing features that call Claude (to avoid real API calls and costs):

```typescript
import { mockClaudeClient, mockFlowGenerationResponse } from '@/test/mocks/claude';
import { vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn(() => mockClaudeClient) }));

it('generates a flow diagram', async () => {
  mockClaudeClient.messages.create.mockResolvedValueOnce(mockFlowGenerationResponse);
  // ... test your code
});
```

### Available Fixtures

| Export                       | Use Case                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| `mockFlowGenerationResponse` | Diagram/graph generation (nodes + edges JSON)                             |
| `mockReviewResponse`         | Code or content review (issues + score)                                   |
| `mockSpecGenerationResponse` | PRD/story generation                                                      |
| `mockChatResponse`           | Multi-persona chat replies                                                |
| `mockClaudeError(type)`      | Error scenarios: `rate_limit`, `timeout`, `invalid_response`, `api_error` |

## Custom Render

Wraps components with all providers needed for the app:

```typescript
import { render, screen } from '@/test/render';

it('renders button', () => {
  render(<MyButton label="Click me" />);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

## API Helpers

```typescript
import { createMockRequest, createMockSession, parseResponse } from '@/test/api-helpers';

// Create a mock POST request with body
const req = createMockRequest('POST', { email: 'a@b.com', password: 'secret123' });

// Create a mock session
const session = createMockSession({ id: 'user-1', email: 'a@b.com', name: 'Alice' });

// Parse a Response object to JSON
const data = await parseResponse<{ id: string }>(response);
```

## Test Database

For integration tests requiring the database, see `src/test/db.ts`.
Tests using the DB run against `productos_test` (separate from `productos` dev DB).

```typescript
import { setupTestDB, teardownTestDB, seedTestDB } from '@/test/db';

beforeAll(async () => {
  await setupTestDB();
  await seedTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});
```
