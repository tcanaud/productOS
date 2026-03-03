'use client';

/**
 * useSequentialEvents — Story 6.6: SSE/Streaming Communication
 *
 * Consumes SSE events from the queue one-by-one and renders them sequentially:
 * - persona-message: delayed by a typing animation (30ms/char, max 2s)
 * - diagram-update / diagram-full: rendered immediately
 * - interaction: halts queue until user responds (isBlocked = true)
 * - Other events: rendered immediately
 *
 * Returns { currentEvent, pendingCount, isBlocked }
 */
import { useEffect, useRef, useState } from 'react';
import type { SSEEvent } from '@/lib/sse/sse.types';

const TYPING_MS_PER_CHAR = 30;
const TYPING_MAX_MS = 2000;

export interface UseSequentialEventsResult {
  currentEvent: SSEEvent | null;
  pendingCount: number;
  isBlocked: boolean;
}

export function useSequentialEvents(events: SSEEvent[]): UseSequentialEventsResult {
  const [processedCount, setProcessedCount] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<SSEEvent | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const processingRef = useRef(false);
  const blockedRef = useRef(false);

  // Compute the pending queue: all events not yet processed or being processed
  const pendingCount = Math.max(0, events.length - processedCount - (currentEvent ? 1 : 0));

  useEffect(() => {
    if (blockedRef.current) return; // Halted by interaction — wait for unblock
    if (processingRef.current) return; // Already processing one event

    const nextIndex = processedCount;
    if (nextIndex >= events.length) return; // Nothing new

    const event = events[nextIndex];
    processingRef.current = true;

    // Defer state updates to avoid calling setState synchronously in the effect body
    queueMicrotask(() => {
      setCurrentEvent(event);

      if (event.type === 'interaction') {
        // Block queue until user provides a response
        blockedRef.current = true;
        setIsBlocked(true);
        processingRef.current = false;
        // Do NOT increment processedCount — interaction is "current" until unblocked
      } else if (event.type === 'persona-message') {
        // Delay based on message length (typing feel), capped at 2s
        const message = (event.data as { message: string }).message ?? '';
        const delay = Math.min(message.length * TYPING_MS_PER_CHAR, TYPING_MAX_MS);

        setTimeout(() => {
          setProcessedCount((c) => c + 1);
          processingRef.current = false;
        }, delay);
      } else {
        // diagram-update, diagram-full, review-annotation, session-end — immediate
        setProcessedCount((c) => c + 1);
        processingRef.current = false;
      }
    });
  }, [events, processedCount]);

  return { currentEvent, pendingCount, isBlocked };
}

/**
 * Utility hook: call this to unblock the queue after an interaction event is answered.
 * Returns an `unblock` callback to be called from the InteractionWidget submit handler.
 */
export function useSequentialEventsUnblocker(
  setIsBlocked: (v: boolean) => void,
  setProcessedCount: (fn: (c: number) => number) => void
) {
  return () => {
    setIsBlocked(false);
    setProcessedCount((c) => c + 1);
  };
}
