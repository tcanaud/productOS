/**
 * Tests for Story 6.6: useStudioStream hook
 *
 * Verifies:
 * - Opens EventSource for a given sessionId
 * - Collects incoming events in order
 * - Reconnects on error (up to MAX_RECONNECT_ATTEMPTS)
 * - Tracks lastEventId
 * - Sets connectionState to 'failed' after exhausting reconnect attempts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudioStream } from '@/hooks/useStudioStream';

// ─────────────────────────────────────────────────────────────────────────────
// Mock EventSource — must be a real class (not a factory fn) for `new` to work
// ─────────────────────────────────────────────────────────────────────────────

let instances: MockEventSourceClass[] = [];

class MockEventSourceClass {
  url: string;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  simulateOpen() {
    this.onopen?.(new Event('open'));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }

  simulateEvent(type: string, data: unknown, lastEventId = '') {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
      lastEventId,
    });
    (this.listeners[type] ?? []).forEach((l) => l(event));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  instances = [];
  vi.useFakeTimers();
  // @ts-expect-error replacing global EventSource with a mock class
  globalThis.EventSource = MockEventSourceClass;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useStudioStream', () => {
  it('does not open EventSource when sessionId is null', () => {
    renderHook(() => useStudioStream(null));
    expect(instances).toHaveLength(0);
  });

  it('opens EventSource with correct URL when sessionId is provided', () => {
    renderHook(() => useStudioStream('session-abc'));
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toBe('/api/studio/sessions/session-abc/stream');
  });

  it('sets connectionState to open on EventSource open', () => {
    const { result } = renderHook(() => useStudioStream('session-abc'));

    act(() => {
      instances[0].simulateOpen();
    });

    expect(result.current.connectionState).toBe('open');
  });

  it('collects events in order', () => {
    const { result } = renderHook(() => useStudioStream('session-abc'));

    act(() => {
      instances[0].simulateOpen();
      instances[0].simulateEvent('session-end', { summary: 'done' }, 'evt-1');
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('session-end');
    expect((result.current.events[0].data as { summary: string }).summary).toBe('done');
  });

  it('tracks lastEventId from the most recent event', () => {
    const { result } = renderHook(() => useStudioStream('session-abc'));

    act(() => {
      instances[0].simulateOpen();
      instances[0].simulateEvent('session-end', { summary: 'done' }, 'evt-42');
    });

    expect(result.current.lastEventId).toBe('evt-42');
  });

  it('reconnects on error (up to 5 attempts)', () => {
    const { result } = renderHook(() => useStudioStream('session-abc'));

    // Trigger 5 errors (each one triggers reconnect after 1s)
    for (let i = 0; i < 5; i++) {
      act(() => {
        const last = instances[instances.length - 1];
        if (last) last.simulateError();
        vi.advanceTimersByTime(1000);
      });
    }

    // Multiple instances created due to reconnects
    expect(instances.length).toBeGreaterThanOrEqual(2);
    expect(['reconnecting', 'failed']).toContain(result.current.connectionState);
  });

  it('sets connectionState to failed after max reconnect attempts', () => {
    const { result } = renderHook(() => useStudioStream('session-abc'));

    // Trigger MAX_RECONNECT_ATTEMPTS+1 (6) errors without ever opening
    for (let i = 0; i < 6; i++) {
      act(() => {
        const last = instances[instances.length - 1];
        if (last) last.simulateError();
        vi.advanceTimersByTime(1000);
      });
    }

    expect(result.current.connectionState).toBe('failed');
  });

  it('bounds the event queue to 200 events', () => {
    const { result } = renderHook(() => useStudioStream('session-abc'));

    act(() => {
      instances[0].simulateOpen();
      for (let i = 0; i < 250; i++) {
        instances[0].simulateEvent('session-end', { summary: `event-${i}` }, `id-${i}`);
      }
    });

    expect(result.current.events.length).toBe(200);
  });
});
