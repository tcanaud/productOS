/**
 * Tests for Story 6.6: SessionEventBus
 *
 * Verifies:
 * - register/unregister/broadcast
 * - Multiple listeners per session receive all events
 * - Emitting to a session with no listeners is a no-op
 * - getListenerCount returns correct count
 */
import { describe, it, expect, vi } from 'vitest';
import { sessionEventBus } from '@/lib/sse/session-event-bus';
import type { SSEEmitter } from '@/lib/sse/sse-emitter';

function makeMockEmitter(): SSEEmitter {
  return {
    emit: vi.fn(),
    heartbeat: vi.fn(),
    close: vi.fn(),
  };
}

describe('SessionEventBus — register/unregister', () => {
  it('registers an emitter and reports listener count', () => {
    const sid = `test-${crypto.randomUUID()}`;
    const emitter = makeMockEmitter();

    expect(sessionEventBus.getListenerCount(sid)).toBe(0);
    sessionEventBus.register(sid, emitter);
    expect(sessionEventBus.getListenerCount(sid)).toBe(1);

    // Cleanup
    sessionEventBus.unregister(sid, emitter);
  });

  it('supports multiple emitters for the same session', () => {
    const sid = `test-${crypto.randomUUID()}`;
    const e1 = makeMockEmitter();
    const e2 = makeMockEmitter();

    sessionEventBus.register(sid, e1);
    sessionEventBus.register(sid, e2);
    expect(sessionEventBus.getListenerCount(sid)).toBe(2);

    sessionEventBus.unregister(sid, e1);
    expect(sessionEventBus.getListenerCount(sid)).toBe(1);

    sessionEventBus.unregister(sid, e2);
    expect(sessionEventBus.getListenerCount(sid)).toBe(0);
  });

  it('unregister removes emitter and cleans up empty sets', () => {
    const sid = `test-${crypto.randomUUID()}`;
    const emitter = makeMockEmitter();

    sessionEventBus.register(sid, emitter);
    sessionEventBus.unregister(sid, emitter);
    expect(sessionEventBus.getListenerCount(sid)).toBe(0);
  });

  it('unregister on unknown session is a safe no-op', () => {
    const emitter = makeMockEmitter();
    expect(() => sessionEventBus.unregister('nonexistent-session', emitter)).not.toThrow();
  });
});

describe('SessionEventBus — emit / broadcast', () => {
  it('broadcasts event to all registered emitters', () => {
    const sid = `test-${crypto.randomUUID()}`;
    const e1 = makeMockEmitter();
    const e2 = makeMockEmitter();

    sessionEventBus.register(sid, e1);
    sessionEventBus.register(sid, e2);

    sessionEventBus.emit(sid, 'session-end', { summary: 'done' });

    expect(e1.emit).toHaveBeenCalledWith('session-end', { summary: 'done' });
    expect(e2.emit).toHaveBeenCalledWith('session-end', { summary: 'done' });

    sessionEventBus.unregister(sid, e1);
    sessionEventBus.unregister(sid, e2);
  });

  it('emitting to a session with no listeners is a silent no-op', () => {
    expect(() =>
      sessionEventBus.emit(`no-listeners-${crypto.randomUUID()}`, 'session-end', {
        summary: 'nothing',
      })
    ).not.toThrow();
  });

  it('does not deliver to emitters of a different session', () => {
    const sid1 = `test-${crypto.randomUUID()}`;
    const sid2 = `test-${crypto.randomUUID()}`;
    const e1 = makeMockEmitter();
    const e2 = makeMockEmitter();

    sessionEventBus.register(sid1, e1);
    sessionEventBus.register(sid2, e2);

    sessionEventBus.emit(sid1, 'session-end', { summary: 'for sid1 only' });

    expect(e1.emit).toHaveBeenCalledTimes(1);
    expect(e2.emit).not.toHaveBeenCalled();

    sessionEventBus.unregister(sid1, e1);
    sessionEventBus.unregister(sid2, e2);
  });

  it('emits persona-message with correct payload', () => {
    const sid = `test-${crypto.randomUUID()}`;
    const emitter = makeMockEmitter();

    sessionEventBus.register(sid, emitter);
    sessionEventBus.emit(sid, 'persona-message', {
      persona: 'john',
      displayName: 'Product Strategist',
      icon: '📋',
      message: 'Hello',
    });

    expect(emitter.emit).toHaveBeenCalledWith('persona-message', {
      persona: 'john',
      displayName: 'Product Strategist',
      icon: '📋',
      message: 'Hello',
    });

    sessionEventBus.unregister(sid, emitter);
  });
});
