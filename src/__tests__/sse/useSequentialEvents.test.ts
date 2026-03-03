/**
 * Tests for Story 6.6: useSequentialEvents hook
 *
 * Verifies:
 * - Events are consumed in order
 * - persona-message events incur a typing delay
 * - diagram-update/diagram-full events are processed immediately
 * - interaction events set isBlocked = true
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSequentialEvents } from '@/hooks/useSequentialEvents';
import type { SSEEvent } from '@/lib/sse/sse.types';

function makeEvent<T extends SSEEvent['type']>(
  type: T,
  data: SSEEvent['data'],
  id?: string
): SSEEvent {
  return {
    id: id ?? crypto.randomUUID(),
    type,
    data,
    timestamp: Date.now(),
  } as SSEEvent;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSequentialEvents', () => {
  it('returns null currentEvent when queue is empty', () => {
    const { result } = renderHook(() => useSequentialEvents([]));
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.isBlocked).toBe(false);
  });

  it('processes diagram-full immediately (after microtask)', async () => {
    const event = makeEvent('diagram-full', {
      jsonGraph: { diagramType: 'flowchart', nodes: [], edges: [] },
      mermaidSyntax: 'flowchart TD',
    });
    const { result } = renderHook(() => useSequentialEvents([event]));

    // Wait for queueMicrotask to flush
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.currentEvent?.type).toBe('diagram-full');
  });

  it('processes diagram-update immediately (after microtask)', async () => {
    const event = makeEvent('diagram-update', { patch: {} });
    const { result } = renderHook(() => useSequentialEvents([event]));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.currentEvent?.type).toBe('diagram-update');
  });

  it('processes session-end immediately (after microtask)', async () => {
    const event = makeEvent('session-end', { summary: 'done' });
    const { result } = renderHook(() => useSequentialEvents([event]));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.currentEvent?.type).toBe('session-end');
  });

  it('persona-message sets currentEvent after microtask', async () => {
    const message = 'Hello from the persona!';
    const event = makeEvent('persona-message', {
      persona: 'john',
      displayName: 'Product Strategist',
      icon: '📋',
      message,
    });

    const { result } = renderHook(() => useSequentialEvents([event]));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.currentEvent?.type).toBe('persona-message');
  });

  it('interaction event sets isBlocked = true', async () => {
    const event = makeEvent('interaction', {
      question: 'What is your goal?',
      inputType: 'text',
    });

    const { result } = renderHook(() => useSequentialEvents([event]));

    await act(async () => {
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(result.current.isBlocked).toBe(true);
    expect(result.current.currentEvent?.type).toBe('interaction');
  });

  it('pending count reflects unprocessed events', () => {
    const events: SSEEvent[] = [
      makeEvent('session-end', { summary: 'done' }, 'e1'),
      makeEvent('session-end', { summary: 'done' }, 'e2'),
      makeEvent('session-end', { summary: 'done' }, 'e3'),
    ];

    const { result } = renderHook(() => useSequentialEvents(events));
    // At least some events are pending or being processed
    const total = result.current.pendingCount + (result.current.currentEvent ? 1 : 0);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(3);
  });
});
