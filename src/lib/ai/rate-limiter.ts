import type { AIEndpoint } from './config';
import { RATE_LIMITS } from './config';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000; // 1 minute

// In-memory store (per-process). Replace with Redis for multi-instance deployments.
const store = new Map<string, RateLimitEntry>();

function makeKey(userId: string, endpoint: AIEndpoint): string {
  return `${userId}:${endpoint}`;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart >= WINDOW_MS) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check and consume a rate limit slot for the given user + endpoint.
 * Returns whether the request is allowed and how many slots remain.
 */
export function checkRateLimit(userId: string, endpoint: AIEndpoint): RateLimitResult {
  pruneExpired();

  const limit = RATE_LIMITS[endpoint];
  const key = makeKey(userId, endpoint);
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (entry.count >= limit) {
    const retryAfterMs = WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
}

/** Reset rate limit for a user + endpoint (useful in tests). */
export function resetRateLimit(userId: string, endpoint: AIEndpoint): void {
  store.delete(makeKey(userId, endpoint));
}

/** Clear all rate limit entries (useful in tests). */
export function clearAllRateLimits(): void {
  store.clear();
}
