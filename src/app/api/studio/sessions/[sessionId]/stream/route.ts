/**
 * GET /api/studio/sessions/[sessionId]/stream
 *
 * Server-Sent Events (SSE) endpoint for studio session streaming.
 * Story 6.6 — SSE/Streaming Communication
 *
 * Auth: session cookie (NextAuth HttpOnly cookie sent automatically by EventSource).
 * The `Last-Event-ID` header is read from reconnecting clients but replay is not
 * implemented for MVP — the stream simply resumes from the next emitted event.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { createSSEStream, SSE_HEADERS } from '@/lib/sse/sse-emitter';
import { sessionEventBus } from '@/lib/sse/session-event-bus';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // 1. Authenticate — EventSource sends HttpOnly session cookies automatically
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  // 2. Create the SSE stream and emitter
  const { stream, emitter } = createSSEStream();

  // 3. Register emitter in the event bus so graph nodes can push events
  sessionEventBus.register(sessionId, emitter);

  // 4. Remove emitter when client disconnects (abort signal fires on close/navigate)
  request.signal.addEventListener('abort', () => {
    sessionEventBus.unregister(sessionId, emitter);
    emitter.close();
  });

  // 5. Return the SSE response
  return new Response(stream, { headers: SSE_HEADERS });
}
