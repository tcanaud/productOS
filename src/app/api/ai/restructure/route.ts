/**
 * POST /api/ai/restructure — Story 11.1
 *
 * Invokes the restructure-layers claudegraph to analyze a flat graph,
 * propose cluster decompositions, and negotiate with the user via SSE.
 *
 * Request body:
 *   { workspaceId, graph, mode?, sessionId?, language?, checkpoint? }
 *
 * On first call: pass workspaceId + graph (no checkpoint).
 * On resume:     pass checkpoint from previous response + user answer.
 *
 * SSE events emitted during run:
 *   - restructure-progress: { step: 'analyzing' | 'proposing' | 'negotiating' | 'applying' | 'done' }
 *   - interaction: { question, inputType } — when AskHumanNode pauses
 *
 * Response:
 *   { type: 'paused', checkpoint, pausedAtNode }  — waiting for user answer
 *   { type: 'done', clusters, updatedGraph }       — user accepted, graph applied
 *   { type: 'error', message }
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { withAI } from '@/lib/ai/middleware';
import { GraphRunner, InMemoryRunStore } from 'claudegraph';
import type { RunCheckpoint, RunOutcome } from 'claudegraph';
import { createRestructureLayersGraph } from '@/lib/graphs/restructure-layers.graph';
import type {
  RestructureState,
  RestructureMode,
  Cluster,
} from '@/lib/graphs/restructure-layers.types';
import { sessionEventBus } from '@/lib/sse/session-event-bus';
import type { RestructureStep } from '@/lib/sse/sse.types';

// ── Request schema ────────────────────────────────────────────────────────────

const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  shape: z.string().optional(),
  type: z.string().optional(),
  childGraphId: z.string().optional(),
});

const GraphEdgeSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
});

const RequestSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  /** Optional studio ID — used to create a pre-restructure checkpoint (Story 11.2). */
  studioId: z.string().optional(),
  graph: z.object({
    diagramType: z.string(),
    nodes: z.array(GraphNodeSchema),
    edges: z.array(GraphEdgeSchema),
    title: z.string().optional(),
    direction: z.string().optional(),
  }),
  mode: z.enum(['bottom-up', 'top-down', 'hybrid']).optional(),
  sessionId: z.string().optional(),
  language: z.string().optional(),
  /** Checkpoint from a previous paused run — used to resume negotiation. */
  checkpoint: z.unknown().optional(),
  /** User's answer when resuming after AskHumanNode pause. */
  userAnswer: z.string().optional(),
});

// ── SSE emit helper ───────────────────────────────────────────────────────────

function emitProgress(
  sessionId: string | undefined,
  step: RestructureStep,
  message: string,
  extra?: Partial<{ clusters: Cluster[]; analysisNotes: string; negotiationRound: number }>
): void {
  if (!sessionId) return;
  sessionEventBus.emit(sessionId, 'restructure-progress', {
    step,
    message,
    ...extra,
  });
}

// ── Runner helpers ─────────────────────────────────────────────────────────────

function createRunner() {
  const graph = createRestructureLayersGraph();
  const runStore = new InMemoryRunStore();
  const runner = new GraphRunner(graph, { maxSteps: 60, runStore });
  return { runner, runStore };
}

function emitSSEForOutcome(sessionId: string | undefined, outcome: RunOutcome): void {
  if (!sessionId) return;

  const state = outcome.state as RestructureState;

  if (outcome.status === 'paused') {
    const pausedNode = outcome.pausedAtNode;

    if (pausedNode === 'present') {
      emitProgress(sessionId, 'negotiating', 'Proposal ready — awaiting your feedback', {
        clusters: state.proposedClusters ?? [],
        analysisNotes: state.analysisNotes,
        negotiationRound: state.negotiationRound,
      });
      // Emit interaction event so the InteractionWidget renders
      const prompt = outcome.request?.prompt ?? 'Please review the proposed clusters.';
      sessionEventBus.emit(sessionId, 'interaction', {
        question: prompt,
        inputType: 'text',
      });
    }
  }

  if (outcome.status === 'ended') {
    const state = outcome.state as RestructureState;
    if (state.error) return;
    const appliedCount = state.appliedLayerIds?.length ?? 0;
    const checkpointNote = state.checkpointId ? ' (checkpoint saved)' : '';
    emitProgress(
      sessionId,
      'done',
      `Restructuring applied — ${appliedCount} layer(s) created${checkpointNote}`,
      { clusters: state.finalClusters ?? [] }
    );
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

async function handler(req: NextRequest, _userId: string): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ type: 'error', message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ type: 'error', message: firstError }, { status: 400 });
  }

  const {
    workspaceId,
    studioId,
    graph,
    mode = 'hybrid',
    sessionId,
    language = 'English',
    checkpoint,
    userAnswer,
  } = parsed.data;

  try {
    const { runner } = createRunner();

    let outcome: RunOutcome;

    if (checkpoint && userAnswer !== undefined) {
      // Resume paused negotiation with user answer
      emitProgress(sessionId, 'negotiating', 'Processing your feedback…');
      const ck = checkpoint as RunCheckpoint;
      const pendingKey = (
        ck as { state?: { _ns?: { sys?: { human?: { pending?: { key?: string } } } } } }
      ).state?._ns?.sys?.human?.pending?.key;
      if (!pendingKey) {
        return NextResponse.json(
          { type: 'error', message: 'Checkpoint has no pending human key — cannot resume' },
          { status: 400 }
        );
      }
      outcome = await runner.resume(ck, { key: pendingKey, value: userAnswer });
    } else {
      // Fresh start
      emitProgress(sessionId, 'analyzing', 'Analyzing graph structure…');

      const initialState: RestructureState = {
        workspaceId,
        ...(studioId ? { studioId } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        graph: graph as any,
        mode: mode as RestructureMode,
        language,
        negotiationRound: 0,
      };

      outcome = await runner.run(initialState);
    }

    // Emit SSE events after each run step
    emitSSEForOutcome(sessionId, outcome);

    const finalState = outcome.state as RestructureState;

    if (outcome.status === 'ended') {
      if (finalState.error) {
        return NextResponse.json({ type: 'error', message: finalState.error }, { status: 500 });
      }
      return NextResponse.json({
        type: 'done',
        clusters: finalState.finalClusters ?? finalState.proposedClusters ?? [],
        ...(finalState.updatedGraph ? { updatedGraph: finalState.updatedGraph } : {}),
        ...(finalState.checkpointId ? { checkpointId: finalState.checkpointId } : {}),
        ...(finalState.appliedLayerIds ? { appliedLayerIds: finalState.appliedLayerIds } : {}),
      });
    }

    if (outcome.status === 'paused') {
      return NextResponse.json({
        type: 'paused',
        checkpoint: outcome.checkpoint,
        pausedAtNode: outcome.pausedAtNode,
        clusters: finalState.proposedClusters ?? [],
        analysisNotes: finalState.analysisNotes,
        negotiationRound: finalState.negotiationRound,
      });
    }

    return NextResponse.json(
      { type: 'error', message: 'Unexpected graph outcome' },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ type: 'error', message }, { status: 500 });
  }
}

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  return withAI(handler, 'flow-generation')(req, authResult.id);
};
