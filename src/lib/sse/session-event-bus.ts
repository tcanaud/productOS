/**
 * SessionEventBus — Story 6.6
 *
 * In-memory pub/sub bus that routes SSE events to all active stream listeners
 * for a given studio session.
 *
 * Singleton stored on `globalThis` to survive Next.js HMR hot-reload cycles
 * (same pattern as PrismaClient singleton in src/lib/prisma.ts).
 *
 * Design notes:
 * - Events are ephemeral: if no listener is registered when emit() is called,
 *   the event is silently dropped (no persistence, no queue).
 * - Multiple tabs / connections for the same session are all notified.
 */
import type { SSEEmitter } from './sse-emitter';
import type { SSEEventType, SSEEventMap } from './sse.types';

class SessionEventBus {
  private readonly listeners = new Map<string, Set<SSEEmitter>>();

  register(sessionId: string, emitter: SSEEmitter): void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(emitter);
  }

  unregister(sessionId: string, emitter: SSEEmitter): void {
    const set = this.listeners.get(sessionId);
    if (!set) return;
    set.delete(emitter);
    if (set.size === 0) {
      this.listeners.delete(sessionId);
    }
  }

  emit<T extends SSEEventType>(sessionId: string, type: T, data: SSEEventMap[T]): void {
    const set = this.listeners.get(sessionId);
    if (!set || set.size === 0) return;
    for (const emitter of set) {
      emitter.emit(type, data);
    }
  }

  getListenerCount(sessionId: string): number {
    return this.listeners.get(sessionId)?.size ?? 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hot-reload safe singleton
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  var __sessionEventBus: SessionEventBus | undefined;
}

export const sessionEventBus: SessionEventBus =
  globalThis.__sessionEventBus ?? (globalThis.__sessionEventBus = new SessionEventBus());
