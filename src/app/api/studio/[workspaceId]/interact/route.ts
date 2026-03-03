/**
 * POST /api/studio/[workspaceId]/interact
 *
 * Drives the studio-session claudegraph one turn at a time.
 *
 * Request body:
 *   { userMessage: string; checkpoint?: RunCheckpoint; sessionId?: string }
 *
 * On first call: pass only userMessage (no checkpoint) → starts a new session.
 * On subsequent calls: pass userMessage + checkpoint from previous response.
 *
 * Response:
 *   { type: 'question'; content: string; runId: string; checkpoint: RunCheckpoint }
 *   { type: 'diagram'; mermaid: string; runId: string; checkpoint: RunCheckpoint; patch?: DiagramPatch; patchAnimation?: PatchAnimationEvent }
 *   { type: 'complete'; diagramId: string }
 *   { type: 'error'; message: string }
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { json2mermaid } from '@/lib/json2mermaid';
import { startStudioSession, resumeStudioSession } from '@/lib/graphs/studio-session.runner';
import type { RunCheckpoint } from '@/lib/graphs/studio-session.runner';
import type { StudioSessionState, PatchAnimationEvent } from '@/lib/graphs/studio-session.types';
import { sessionManager } from '@/lib/session/session-manager';

/** Derive a PatchAnimationEvent from the last applied patch for frontend animation. */
function derivePatchAnimation(state: StudioSessionState): PatchAnimationEvent | undefined {
  const patch = state.lastPatch;
  if (!patch) return undefined;

  // Determine dominant type: add > remove > modify
  const addNodeIds = patch.addNodes?.map((n) => n.id) ?? [];
  const removeNodeIds = patch.removeNodes ?? [];
  const modifyNodeIds = patch.modifyNodes?.map((n) => n.id) ?? [];
  const addEdgeIds = (patch.addEdges?.map((e) => e.id).filter(Boolean) as string[]) ?? [];
  const removeEdgeIds = patch.removeEdges ?? [];

  if (addNodeIds.length > 0 || addEdgeIds.length > 0) {
    return { type: 'add', nodeIds: addNodeIds, edgeIds: addEdgeIds };
  }
  if (removeNodeIds.length > 0 || removeEdgeIds.length > 0) {
    return { type: 'remove', nodeIds: removeNodeIds, edgeIds: removeEdgeIds };
  }
  if (modifyNodeIds.length > 0) {
    return { type: 'modify', nodeIds: modifyNodeIds, edgeIds: [] };
  }

  return undefined;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { workspaceId } = await params;

  let body: { userMessage?: string; checkpoint?: RunCheckpoint; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ type: 'error', message: 'Invalid JSON body' }, { status: 400 });
  }

  const { userMessage, checkpoint, sessionId } = body;

  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    return NextResponse.json(
      { type: 'error', message: 'userMessage is required' },
      { status: 400 }
    );
  }

  try {
    let outcome: Awaited<ReturnType<typeof startStudioSession>>;

    if (checkpoint) {
      // Resume existing session (Story 6.6: pass sessionId for SSE routing)
      outcome = await resumeStudioSession(checkpoint, userMessage.trim(), sessionId);
    } else {
      // Story 6.7: ensure BMAD session exists and load context for this workspace
      const sessionCtx = await sessionManager.loadContext(workspaceId);
      // Start new session (Story 6.6: pass sessionId; Story 6.7: pass sessionDir)
      outcome = await startStudioSession(
        workspaceId,
        userMessage.trim(),
        sessionId,
        sessionCtx.sessionDir
      );
    }

    const finalState = outcome.state as StudioSessionState;

    if (outcome.status === 'ended') {
      // Graph ran to END — diagram confirmed and ready to persist
      if (!finalState.currentDiagram) {
        return NextResponse.json(
          { type: 'error', message: 'Session ended without a diagram' },
          { status: 500 }
        );
      }

      // Persist diagram to database
      const mermaidContent = json2mermaid(finalState.currentDiagram);
      const diagram = await prisma.diagram.create({
        data: {
          workspaceId,
          title: finalState.currentDiagram.title ?? 'Studio Diagram',
          content: mermaidContent,
          diagramType: finalState.currentDiagram.diagramType,
        },
      });

      // Story 6.7: persist artifacts to BMAD session filesystem
      await sessionManager.persistArtifacts(workspaceId, {
        diagramJson: JSON.stringify(finalState.currentDiagram),
        diagramMermaid: mermaidContent,
        version: diagram.id,
        state: { lastDiagramId: diagram.id },
      });

      return NextResponse.json({ type: 'complete', diagramId: diagram.id });
    }

    if (outcome.status === 'paused') {
      const pausedNode = outcome.pausedAtNode;
      const pendingRequest = outcome.request;
      const serializedCheckpoint = outcome.checkpoint;

      // Determine response type based on which InteractionNode paused
      if (pausedNode === 'present-diagram-to-user') {
        const currentDiagram = finalState.currentDiagram;
        const mermaid = currentDiagram ? json2mermaid(currentDiagram) : '';
        // Story 6.5: derive patch animation event for frontend
        const patchAnimation = derivePatchAnimation(finalState);
        return NextResponse.json({
          type: 'diagram',
          mermaid,
          runId: outcome.runId,
          checkpoint: serializedCheckpoint,
          ...(finalState.lastPatch ? { patch: finalState.lastPatch } : {}),
          ...(patchAnimation ? { patchAnimation } : {}),
        });
      }

      // Default: question pause (present-to-user node)
      // Story 6.4: include parsed persona messages when party mode is active
      const personasPayload =
        finalState.partyModeEnabled && finalState.personaMessages.length > 0
          ? { personas: finalState.personaMessages }
          : {};

      return NextResponse.json({
        type: 'question',
        content: pendingRequest?.prompt ?? 'What would you like to design?',
        runId: outcome.runId,
        checkpoint: serializedCheckpoint,
        ...personasPayload,
      });
    }

    // Unexpected outcome
    return NextResponse.json(
      { type: 'error', message: 'Unexpected graph outcome' },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ type: 'error', message }, { status: 500 });
  }
}
