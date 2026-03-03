/**
 * SSE Emitter — Story 6.6
 *
 * Creates an SSE emitter bound to a ReadableStream controller.
 * Use with the Web Streams API (Next.js App Router compatible).
 *
 * SSE frame format:
 *   id: <event-id>\n
 *   event: <event-type>\n
 *   data: <json-payload>\n
 *   \n
 */
import type { SSEEventType, SSEEventMap } from './sse.types';

let _counter = 0;

function nextId(): string {
  return String(++_counter);
}

export interface SSEEmitter {
  emit<T extends SSEEventType>(type: T, data: SSEEventMap[T]): void;
  heartbeat(): void;
  close(): void;
}

/**
 * Standard SSE response headers.
 * Include these on the Response returned from the GET handler.
 */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * Create an SSE emitter backed by a ReadableStream.
 *
 * Returns both the `ReadableStream` (to pass to `new Response(stream, ...)`)
 * and the `SSEEmitter` interface (to call `emit(type, data)` from the event bus).
 */
export function createSSEStream(): { stream: ReadableStream<Uint8Array>; emitter: SSEEmitter } {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;

      // Send a heartbeat comment every 15 seconds to keep the connection alive
      heartbeatTimer = setInterval(() => {
        if (!closed && controller) {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch {
            // Controller may be closed — ignore
          }
        }
      }, 15_000);
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });

  const emitter: SSEEmitter = {
    emit<T extends SSEEventType>(type: T, data: SSEEventMap[T]): void {
      if (closed || !controller) return;
      const id = nextId();
      const frame = `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
      try {
        controller.enqueue(encoder.encode(frame));
      } catch {
        // Stream may have been closed by the client — ignore
      }
    },

    heartbeat(): void {
      if (closed || !controller) return;
      try {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      } catch {
        // ignore
      }
    },

    close(): void {
      if (closed) return;
      closed = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      try {
        controller?.close();
      } catch {
        // Already closed — ignore
      }
    },
  };

  return { stream, emitter };
}
