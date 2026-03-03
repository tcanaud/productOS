/**
 * Studio Session Runner
 *
 * Wraps GraphRunner for studio sessions.
 * Provides start / resume helpers and exposes the RunOutcome
 * so the API route can serialize the checkpoint for subsequent turns.
 */
import { GraphRunner, InMemoryRunStore } from 'claudegraph';
import type { RunCheckpoint, RunOutcome } from 'claudegraph';
import { createStudioSessionGraph } from './studio-session.graph';
import type { StudioSessionState } from './studio-session.types';

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
 * Start a brand-new studio session.
 *
 * @param workspaceId - The workspace this session belongs to.
 * @param userMessage - First message from the user.
 */
export async function startStudioSession(
  workspaceId: string,
  userMessage: string
): Promise<RunOutcome> {
  const { runner } = createStudioSessionRunner();

  const initialState: StudioSessionState = {
    workspaceId,
    messages: [{ role: 'user', content: userMessage }],
    personaResponses: {},
    currentDiagram: null,
    intent: null,
    contextScore: 0,
  };

  return runner.run(initialState);
}

/**
 * Resume a paused studio session with a new user message.
 *
 * @param checkpoint - The RunCheckpoint returned from the previous turn.
 * @param userMessage - The user's response to the AskHumanNode prompt.
 */
export async function resumeStudioSession(
  checkpoint: RunCheckpoint,
  userMessage: string
): Promise<RunOutcome> {
  const { runner } = createStudioSessionRunner();

  const pendingKey = checkpoint.state?._ns?.sys?.human?.pending?.key;
  if (!pendingKey) {
    throw new Error('Checkpoint has no pending human key — cannot resume');
  }

  return runner.resume(checkpoint, { key: pendingKey, value: userMessage });
}
