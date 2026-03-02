/**
 * Story 0.4 — Task 7 verification tests
 * Demonstrates that unit, component, and API tests are all functional.
 */
import { describe, it, expect } from 'vitest';
import { createMockRequest, createMockSession, parseResponse } from './api-helpers';
import { createTestUser, createTestWorkspace, createTestDiagram } from './factories';
import { mockFlowGenerationResponse, mockReviewResponse, mockClaudeError } from './mocks/claude';

// ---------------------------------------------------------------------------
// Unit test: utility function
// ---------------------------------------------------------------------------

describe('factories — createTestUser', () => {
  it('creates a user with default values', () => {
    const user = createTestUser();
    expect(user.id).toBeTruthy();
    expect(user.email).toMatch(/@example\.com$/);
    expect(user.name).toBe('Test User');
  });

  it('accepts overrides', () => {
    const user = createTestUser({ email: 'custom@test.com', name: 'Custom' });
    expect(user.email).toBe('custom@test.com');
    expect(user.name).toBe('Custom');
  });
});

describe('factories — createTestWorkspace', () => {
  it('creates a workspace with default values', () => {
    const ws = createTestWorkspace();
    expect(ws.id).toBeTruthy();
    expect(ws.name).toBe('Test Workspace');
  });
});

describe('factories — createTestDiagram', () => {
  it('creates a diagram with default values', () => {
    const d = createTestDiagram();
    expect(d.id).toBeTruthy();
    expect(d.content).toBe('{}');
  });
});

// ---------------------------------------------------------------------------
// API helpers test
// ---------------------------------------------------------------------------

describe('api-helpers — createMockRequest', () => {
  it('creates a GET request', () => {
    const req = createMockRequest('GET');
    expect(req.method).toBe('GET');
  });

  it('creates a POST request with JSON body', async () => {
    const body = { email: 'a@b.com', password: 'secret123' };
    const req = createMockRequest('POST', body);
    expect(req.method).toBe('POST');
    const parsed = await req.json();
    expect(parsed).toEqual(body);
  });
});

describe('api-helpers — createMockSession', () => {
  it('creates a session with user data', () => {
    const session = createMockSession({ id: 'user-1', email: 'a@b.com', name: 'Alice' });
    expect(session.user.id).toBe('user-1');
    expect(session.user.email).toBe('a@b.com');
    expect(session.expires).toBeTruthy();
  });
});

describe('api-helpers — parseResponse', () => {
  it('parses JSON from a Response object', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await parseResponse<{ ok: boolean }>(response);
    expect(data.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Claude mock fixtures test
// ---------------------------------------------------------------------------

describe('claude mocks — fixtures', () => {
  it('mockFlowGenerationResponse has nodes and edges', () => {
    const text = mockFlowGenerationResponse.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);
  });

  it('mockReviewResponse has score', () => {
    const text = mockReviewResponse.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.score).toBe(85);
  });

  it('mockClaudeError returns rate_limit error with status 429', () => {
    const err = mockClaudeError('rate_limit') as Error & { status?: number };
    expect(err.message).toContain('Rate limit');
    expect(err.status).toBe(429);
  });

  it('mockClaudeError returns timeout error with ETIMEDOUT code', () => {
    const err = mockClaudeError('timeout') as Error & { code?: string };
    expect(err.code).toBe('ETIMEDOUT');
  });
});
