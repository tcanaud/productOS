/**
 * Request handlers for intercepting fetch calls in tests.
 *
 * Uses direct vi.fn() injection rather than MSW for MVP simplicity.
 * Import and use in beforeEach/afterEach as needed.
 *
 * Example:
 *   import { mockFetchHandler } from '@/test/mocks/handlers';
 *   beforeEach(() => { global.fetch = mockFetchHandler({ status: 200, body: { ok: true } }); });
 */
import { vi } from 'vitest';

export interface MockFetchOptions {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export function mockFetchHandler(options: MockFetchOptions = {}) {
  const { status = 200, body = {}, headers = {} } = options;
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    })
  );
}
