/**
 * POST /api/studio/[workspaceId]/interact
 *
 * Drives the studio-session claudegraph one turn at a time.
 *
 * Request body:
 *   { userMessage: string; checkpoint?: RunCheckpoint }
 *
 * On first call: pass only userMessage (no checkpoint) → starts a new session.
 * On subsequent calls: pass userMessage + checkpoint from previous response.
 *
 * Response:
 *   { type: 'question'; content: string; runId: string; checkpoint: RunCheckpoint }
 *   { type: 'diagram'; mermaid: string; runId: string; checkpoint: RunCheckpoint; patch?: DiagramPatch }
 *   { type: 'complete'; diagramId: string }
 *   { type: 'error'; message: string }
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { json2mermaid } from '@/lib/json2mermaid';
import { startStudioSession, resumeStudioSession } from '@/lib/graphs/studio-session.runner';
import type { RunCheckpoint } from '@/lib/graphs/studio-session.runner';
import type { StudioSessionState } from '@/lib/graphs/studio-session.types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { workspaceId } = await params;

  let body: { userMessage?: string; checkpoint?: RunCheckpoint };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ type: 'error', message: 'Invalid JSON body' }, { status: 400 });
  }

  const { userMessage, checkpoint } = body;

  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    return NextResponse.json(
      { type: 'error', message: 'userMessage is required' },
      { status: 400 }
    );
  }

  try {
    let outcome: Awaited<ReturnType<typeof startStudioSession>>;

    if (checkpoint) {
      // Resume existing session
      outcome = await resumeStudioSession(checkpoint, userMessage.trim());
    } else {
      // Start new session
      outcome = await startStudioSession(workspaceId, userMessage.trim());
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
        return NextResponse.json({
          type: 'diagram',
          mermaid,
          runId: outcome.runId,
          checkpoint: serializedCheckpoint,
          ...(finalState.lastPatch ? { patch: finalState.lastPatch } : {}),
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
