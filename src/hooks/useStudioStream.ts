'use client';

/**
 * useStudioStream — Story 6.6: SSE/Streaming Communication
 *
 * React hook that opens an EventSource connection to the studio SSE endpoint
 * and collects incoming events in a bounded, ordered queue.
 *
 * Features:
 * - Automatic reconnection on error (up to 5 attempts, 1s delay each)
 * - Resumes from last received event ID (sent via query param on reconnect)
 * - Bounded event queue (max 200 events)
 * - Connection state tracking: 'connecting' | 'open' | 'reconnecting' | 'failed'
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SSEEvent, SSEEventType, SSEEventMap } from '@/lib/sse/sse.types';

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'failed';

const MAX_EVENTS = 200;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;

export interface UseStudioStreamResult {
  events: SSEEvent[];
  connectionState: ConnectionState;
  lastEventId: string | null;
  /** Resolves when the SSE connection reaches 'open' state. If already open, resolves immediately. */
  waitForOpen: () => Promise<void>;
}

export function useStudioStream(sessionId: string | null): UseStudioStreamResult {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  // Store the connection function in a ref so it can call itself without
  // creating a circular dependency between useCallback and useEffect.
  const connectRef = useRef<() => void>(() => undefined);
  // Pending resolvers for waitForOpen() — flushed when EventSource reaches 'open'
  const openResolversRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!sessionId) return;

    function connect() {
      const url = lastEventIdRef.current
        ? `/api/studio/sessions/${sessionId}/stream?lastEventId=${encodeURIComponent(lastEventIdRef.current)}`
        : `/api/studio/sessions/${sessionId}/stream`;

      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnectionState('open');
        // Flush any pending waitForOpen() promises
        for (const resolve of openResolversRef.current) resolve();
        openResolversRef.current = [];
      };

      // Handle each SSE event type
      const handleEvent = (type: SSEEventType) => (event: MessageEvent) => {
        const rawData = event.data as string;
        if (event.lastEventId) {
          lastEventIdRef.current = event.lastEventId;
          setLastEventId(event.lastEventId);
        }

        let data: SSEEventMap[typeof type];
        try {
          data = JSON.parse(rawData) as SSEEventMap[typeof type];
        } catch {
          return; // Malformed data — skip
        }

        const sseEvent: SSEEvent<typeof type> = {
          id: event.lastEventId || String(Date.now()),
          type,
          data,
          timestamp: Date.now(),
        };

        setEvents((prev) => {
          const next = [...prev, sseEvent];
          return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
        });
      };

      const EVENT_TYPES: SSEEventType[] = [
        'persona-message',
        'roundtable',
        'interaction',
        'diagram-update',
        'diagram-full',
        'review-annotation',
        'session-end',
      ];

      for (const type of EVENT_TYPES) {
        es.addEventListener(type, handleEvent(type) as EventListener);
      }

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionState('failed');
          return;
        }

        reconnectAttemptsRef.current += 1;
        setConnectionState('reconnecting');

        reconnectTimerRef.current = setTimeout(() => {
          connectRef.current();
        }, RECONNECT_DELAY_MS);
      };
    }

    connectRef.current = connect;

    reconnectAttemptsRef.current = 0;
    // Defer state update to avoid calling setState synchronously in the effect body
    queueMicrotask(() => setConnectionState('connecting'));
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [sessionId]);

  const waitForOpen = useCallback((): Promise<void> => {
    // Already connected — resolve immediately
    if (esRef.current?.readyState === EventSource.OPEN) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      openResolversRef.current.push(resolve);
    });
  }, []);

  return {
    events,
    connectionState,
    lastEventId,
    waitForOpen,
  };
}
