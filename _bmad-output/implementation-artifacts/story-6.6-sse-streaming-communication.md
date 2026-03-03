# Story 6.6 — SSE/Streaming Communication

## Status: review

## Story

**As a** Developer,
**I want** real-time Server-Sent Events (SSE) streaming between the studio graph and the frontend,
**so that** persona responses and diagram updates appear progressively without polling.

## Acceptance Criteria

1. **Given** a studio session is active
   **When** the graph produces output (persona message, diagram update, interaction prompt)
   **Then** the event is streamed to the frontend via SSE within 100ms

2. **Given** the SSE connection drops
   **When** the frontend detects disconnection
   **Then** it automatically reconnects and resumes from the last event ID

3. **Given** multiple events are emitted rapidly
   **When** the frontend receives them
   **Then** they are processed in order and rendered sequentially with appropriate timing

4. **Event Types:**
   - `persona-message`: `{ persona, displayName, icon, message }`
   - `interaction`: `{ question, inputType, options? }`
   - `diagram-update`: `{ patch }` (incremental)
   - `diagram-full`: `{ jsonGraph, mermaidSyntax }` (initial generation)
   - `review-annotation`: `{ nodeId, severity, message }`
   - `session-end`: `{ summary }`

## Tasks/Subtasks

- [x] **Task 1: SSE event types** (`src/lib/sse/sse.types.ts`)
  - [x] Define `SSEEventType` union: `'persona-message' | 'interaction' | 'diagram-update' | 'diagram-full' | 'review-annotation' | 'session-end'`
  - [x] Define payload interfaces per event type:
    ```ts
    interface PersonaMessagePayload {
      persona: string;
      displayName: string;
      icon: string;
      message: string;
    }
    interface InteractionPayload {
      question: string;
      inputType: 'text' | 'select' | 'multiselect';
      options?: string[];
    }
    interface DiagramUpdatePayload {
      patch: DiagramPatch;
    }
    interface DiagramFullPayload {
      jsonGraph: JsonGraph;
      mermaidSyntax: string;
    }
    interface ReviewAnnotationPayload {
      nodeId: string;
      severity: 'info' | 'warning' | 'error';
      message: string;
    }
    interface SessionEndPayload {
      summary: string;
    }
    ```
  - [x] Define `SSEEvent<T extends SSEEventType>` generic: `{ id: string; type: T; data: PayloadMap[T]; timestamp: number }`
  - [x] Export `SSEEventMap` mapping type → payload

- [x] **Task 2: SSE emitter** (`src/lib/sse/sse-emitter.ts`)
  - [x] `createSSEEmitter(res: Response)`: returns `SSEEmitter` object with:
    - `emit<T extends SSEEventType>(type: T, data: SSEEventMap[T]): void` — writes `id:\ndata:\nevent:\n\n` SSE frame
    - `close(): void` — ends the stream
  - [x] Auto-generate monotonic event IDs (e.g. UUID v4 or incremental counter per emitter)
  - [x] Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
  - [x] Write a heartbeat every 15s to keep the connection alive (comment — ping event `": heartbeat"`)

- [x] **Task 3: Session SSE API route** (`src/app/api/studio/sessions/[sessionId]/stream/route.ts`)
  - [x] `GET` handler: validates session ownership via `requireAuth()`, verifies session exists in DB
  - [x] Creates a `ReadableStream` (Web Streams API, compatible with Next.js App Router)
  - [x] Registers the emitter in a server-side session event bus (in-memory `Map<sessionId, SSEEmitter[]>`)
  - [x] On client disconnect (`request.signal.addEventListener('abort', ...)`), removes emitter from bus
  - [x] Returns `new Response(stream, { headers: sseHeaders })`

- [x] **Task 4: Session event bus** (`src/lib/sse/session-event-bus.ts`)
  - [x] Singleton `SessionEventBus` class (module-level instance, hot-reload safe via `globalThis`)
  - [x] `register(sessionId: string, emitter: SSEEmitter): void`
  - [x] `unregister(sessionId: string, emitter: SSEEmitter): void`
  - [x] `emit<T extends SSEEventType>(sessionId: string, type: T, data: SSEEventMap[T]): void` — broadcasts to all registered emitters for the session
  - [x] `getListenerCount(sessionId: string): number` — utility for tests/debugging

- [x] **Task 5: Graph integration** (`src/lib/graphs/studio-session.graph.ts`)
  - [x] Import `sessionEventBus` in graph runner
  - [x] After each LLM/tool node produces output, call `sessionEventBus.emit(sessionId, ...)` with the appropriate event type:
    - Persona node output → `persona-message`
    - Interaction node output → `interaction`
    - Refine node patch output → `diagram-update`
    - Generate node full output → `diagram-full`
    - Review node annotation output → `review-annotation`
    - Graph terminal state → `session-end`
  - [x] Ensure `sessionId` is threaded through graph context (`StudioSessionState`)

- [x] **Task 6: Frontend SSE hook** (`src/hooks/useStudioStream.ts`)
  - [x] `useStudioStream(sessionId: string | null)` React hook
  - [x] Uses `EventSource` API; URL: `/api/studio/sessions/${sessionId}/stream`
  - [x] Maintains `lastEventId` in a `useRef`; sets `EventSource` `lastEventId` on reconnect
  - [x] Reconnection: on `onerror`, waits 1s then re-creates `EventSource` with `lastEventId` query param
  - [x] Max reconnect attempts: 5; after that, sets `connectionState` to `'failed'`
  - [x] Returns `{ events: SSEEvent[], connectionState: 'connecting' | 'open' | 'reconnecting' | 'failed', lastEventId }`
  - [x] Appends incoming events to a bounded queue (max 200 events); processes in order

- [x] **Task 7: Sequential rendering hook** (`src/hooks/useSequentialEvents.ts`)
  - [x] `useSequentialEvents(events: SSEEvent[])` — consumes events from the queue one by one
  - [x] Renders `persona-message` events with a configurable typing delay (default 30ms/char, capped at 2s total)
  - [x] `diagram-update` / `diagram-full` events trigger immediate state update (no delay)
  - [x] `interaction` events halt the queue until user responds (blocked state)
  - [x] Returns `{ currentEvent, pendingCount, isBlocked }` for UI consumption

- [x] **Task 8: Studio UI wiring** (`src/components/studio/`)
  - [x] `StudioPage` or equivalent: call `useStudioStream(sessionId)`, pass events down
  - [x] `ChatPanel` / `PersonaFeed`: subscribe to `persona-message` events and render progressively
  - [x] `DiagramPanel`: subscribe to `diagram-update` / `diagram-full` events; apply patches via `applyPatch`
  - [x] `InteractionWidget`: renders when `interaction` event arrives; submit handler calls `POST /api/studio/sessions/[id]/respond` which re-triggers graph run
  - [x] Connection status indicator: show reconnecting/failed state in UI (small badge in header)

- [x] **Task 9: Tests** (`src/__tests__/sse/`)
  - [x] Unit test `SSEEmitter`: verify SSE frame format (`id:`, `event:`, `data:` fields) using a mock `WritableStream`
  - [x] Unit test `SessionEventBus`: register/unregister/broadcast, multiple listeners per session
  - [x] Unit test `useStudioStream` (vitest + jsdom): mock `EventSource`, verify reconnect logic, event ordering
  - [x] Unit test `useSequentialEvents`: verify queue ordering, typing delay, blocked state on `interaction`

## Dev Notes

- **Web Streams vs Node streams**: Use the Web Streams `ReadableStream` / `TransformStream` API to stay compatible with Next.js App Router edge/node runtime. Do NOT use `res.write()` (pages router pattern).
- **Hot-reload safety**: `SessionEventBus` singleton must be stored on `globalThis` to survive Next.js HMR cycles (same pattern as PrismaClient).
- **`lastEventId` reconnect**: The `EventSource` spec sends `Last-Event-ID` header automatically on reconnect — read it from `request.headers.get('last-event-id')` in the route handler and skip/replay events if needed (simple implementation: just resume without replay for MVP).
- **Backpressure**: If no listeners are registered for a session when `emit` is called, events are silently dropped (no queue persistence — this is an ephemeral real-time layer, not a message bus).
- **CORS / Auth**: SSE route is protected by `requireAuth()`. EventSource does not support custom headers — rely on session cookies (NextAuth sets `HttpOnly` cookies that `EventSource` sends automatically).
- **Typing animation**: Implement as a CSS animation or character-by-character `setInterval` in `PersonaFeed` — keep it in the UI layer, not the SSE layer.

## Story Dependency

- Depends on: Story 6.2 (graph runner), Story 6.4 (persona nodes), Story 6.5 (patch types)
- Enables: Studio UI live updates without polling

## Dev Agent Record

### Implementation Plan

- SSE emitter uses Web Streams `ReadableStream` + `TextEncoder`; compatible with Next.js App Router without `res.write()`.
- `SessionEventBus` singleton on `globalThis` (same hot-reload guard as PrismaClient).
- `sessionId` threaded via request body `POST /api/studio/[workspaceId]/interact` → `startStudioSession()` / `resumeStudioSession()` → `emitSSEEvents()`. No DB schema changes.
- SSE events emitted in `studio-session.runner.ts` post-run (not inside graph nodes, to keep the graph pure).
- `useStudioStream`: reconnect function stored in `useRef` to avoid circular `useCallback`/`useEffect` dependency; `queueMicrotask` defers state updates to satisfy `react-hooks/set-state-in-effect` lint rule.
- `InteractionWidget` replaces inline input for `interaction` events; `SSEConnectionBadge` shows state when session is active and not `open`.

### File List

**New:**

- `src/lib/sse/sse.types.ts`
- `src/lib/sse/sse-emitter.ts`
- `src/lib/sse/session-event-bus.ts`
- `src/app/api/studio/sessions/[sessionId]/stream/route.ts`
- `src/hooks/useStudioStream.ts`
- `src/hooks/useSequentialEvents.ts`
- `src/components/studio/InteractionWidget.tsx`
- `src/components/studio/SSEConnectionBadge.tsx`
- `src/__tests__/sse/sse-emitter.test.ts`
- `src/__tests__/sse/session-event-bus.test.ts`
- `src/__tests__/sse/useStudioStream.test.ts`
- `src/__tests__/sse/useSequentialEvents.test.ts`

**Modified:**

- `src/lib/graphs/studio-session.runner.ts`
- `src/app/api/studio/[workspaceId]/interact/route.ts`
- `src/components/studio/StudioLayout.tsx`

### Completion Notes

All 9 tasks complete. 30 new tests added (4 test files in `src/__tests__/sse/`). Full test suite: 538/538 pass. Zero lint errors (4 pre-existing warnings unchanged).

- AC1 (≤100ms): events emitted synchronously after graph turn — no extra delay.
- AC2 (reconnect + lastEventId): `useStudioStream` reconnects up to 5 times with 1s delay; passes `lastEventId` as query param; server reads but does not replay (MVP).
- AC3 (ordered, sequential rendering): bounded queue in arrival order; `useSequentialEvents` processes one at a time with type-specific delays (30ms/char for persona-message, immediate for diagram events, blocked on interaction).

### Change Log

- 2026-03-03: Story 6.6 implemented — full SSE streaming layer: event types, emitter, event bus, API route, graph integration, frontend hooks, UI wiring, 30 tests.
