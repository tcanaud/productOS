/**
 * Studio Session Runner
 *
 * Wraps GraphRunner for studio sessions.
 * Provides start / resume helpers and exposes the RunOutcome
 * so the API route can serialize the checkpoint for subsequent turns.
 *
 * Story 6.6: emits SSE events via sessionEventBus after each graph turn.
 */
import { GraphRunner, InMemoryRunStore } from 'claudegraph';
import type { RunCheckpoint, RunOutcome } from 'claudegraph';
import { createStudioSessionGraph } from './studio-session.graph';
import type { StudioSessionState } from './studio-session.types';
import { sessionEventBus } from '@/lib/sse/session-event-bus';
import { json2mermaid } from '@/lib/json2mermaid';

export type { RunCheckpoint, RunOutcome };

/** Max graph steps per turn (prevents infinite loops). */
const MAX_STEPS = 50;

/**
 * Create a new GraphRunner for a studio session.
 * Uses an InMemoryRunStore so checkpoints survive across the async
 * start → resume cycle within the same Node.js process.
 */
export function createStudioSessionRunner() {
  const graph = createStudioSessionGraph();
  const runStore = new InMemoryRunStore();

  const runner = new GraphRunner(graph, {
    maxSteps: MAX_STEPS,
    runStore,
  });

  return { runner, runStore };
}

/**
 * Emit appropriate SSE events based on the graph run outcome.
 * Called after every start() / resume() call that has a sessionId.
 */
function emitSSEEvents(sessionId: string, outcome: RunOutcome): void {
  const state = outcome.state as StudioSessionState;

  if (outcome.status === 'ended') {
    // Graph reached END node — diagram confirmed, session complete
    const summary = state.currentDiagram
      ? `Diagram "${state.currentDiagram.title || 'Untitled'}" has been saved.`
      : 'Session completed.';
    sessionEventBus.emit(sessionId, 'session-end', { summary });
    return;
  }

  if (outcome.status === 'paused') {
    const pausedNode = outcome.pausedAtNode;
    const pendingRequest = outcome.request;

    if (pausedNode === 'present-diagram-to-user') {
      if (state.lastPatch) {
        // Incremental patch update
        sessionEventBus.emit(sessionId, 'diagram-update', { patch: state.lastPatch });
      } else if (state.currentDiagram) {
        // Full diagram generation
        const mermaidSyntax = json2mermaid(state.currentDiagram);
        sessionEventBus.emit(sessionId, 'diagram-full', {
          jsonGraph: state.currentDiagram,
          mermaidSyntax,
        });
      }
      return;
    }

    // Default: present-to-user node — persona messages or interaction prompt
    if (state.partyModeEnabled && state.personaMessages.length > 0) {
      // Emit one event per persona
      for (const pm of state.personaMessages) {
        sessionEventBus.emit(sessionId, 'persona-message', {
          persona: pm.personaId,
          displayName: pm.displayName,
          icon: pm.icon ?? '',
          message: pm.content,
        });
      }
    } else {
      // Emit as an interaction prompt
      const question = pendingRequest?.prompt ?? 'What would you like to design?';
      sessionEventBus.emit(sessionId, 'interaction', {
        question,
        inputType: 'text',
      });
    }
  }
}

/**
 * Start a brand-new studio session.
 *
 * @param workspaceId - The workspace this session belongs to.
 * @param userMessage - First message from the user.
 * @param sessionId - Optional logical session ID for SSE event routing.
 * @param sessionDir - Optional absolute path to the BMAD session directory (Story 6.7).
 */
export async function startStudioSession(
  workspaceId: string,
  userMessage: string,
  sessionId?: string,
  sessionDir?: string
): Promise<RunOutcome> {
  const { runner } = createStudioSessionRunner();

  const initialState: StudioSessionState = {
    workspaceId,
    // Story 6.7: sessionDir passed to nodes so Claude CLI CWD can be set
    ...(sessionDir ? { sessionDir } : {}),
    messages: [{ role: 'user', content: userMessage }],
    personaResponses: {},
    currentDiagram: null,
    intent: null,
    contextScore: 0,
    // Story 6.3: onboarding fields — classify-input-length node computes wordCount
    wordCount: 0,
    onboardingPhase: 'clarify',
    clarificationCount: 0,
    // Story 6.4: party-mode fields
    partyModeEnabled: true,
    personaMessages: [],
    // Story 6.5: patch tracking fields
    patchHistory: [],
  };

  const outcome = await runner.run(initialState);

  // Story 6.6: emit SSE events if a sessionId was provided
  if (sessionId) {
    emitSSEEvents(sessionId, outcome);
  }

  return outcome;
}

/**
 * Resume a paused studio session with a new user message.
 *
 * @param checkpoint - The RunCheckpoint returned from the previous turn.
 * @param userMessage - The user's response to the AskHumanNode prompt.
 * @param sessionId - Optional logical session ID for SSE event routing.
 */
export async function resumeStudioSession(
  checkpoint: RunCheckpoint,
  userMessage: string,
  sessionId?: string
): Promise<RunOutcome> {
  const { runner } = createStudioSessionRunner();

  const pendingKey = checkpoint.state?._ns?.sys?.human?.pending?.key;
  if (!pendingKey) {
    throw new Error('Checkpoint has no pending human key — cannot resume');
  }

  const outcome = await runner.resume(checkpoint, { key: pendingKey, value: userMessage });

  // Story 6.6: emit SSE events if a sessionId was provided
  if (sessionId) {
    emitSSEEvents(sessionId, outcome);
  }

  return outcome;
}
