/**
 * POST /api/studio/[workspaceId]/interact
 *
 * Drives the studio-session claudegraph one turn at a time.
 *
 * Request body:
 *   { userMessage: string; checkpoint?: RunCheckpoint; sessionId?: string;
 *     studioId?: string; messages?: unknown[] }
 *
 * On first call: pass only userMessage (no checkpoint) → starts a new session.
 * On subsequent calls: pass userMessage + checkpoint from previous response.
 *
 * Response:
 *   { type: 'question'; ...; studioId: string }
 *   { type: 'diagram'; ...; studioId: string }
 *   { type: 'complete'; diagramId: string; studioId: string }
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
import { studioPersistence } from '@/lib/studio/studio-persistence';
import { checkpointPersistence } from '@/lib/studio/checkpoint-persistence';

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

  let body: {
    userMessage?: string;
    checkpoint?: RunCheckpoint;
    sessionId?: string;
    studioId?: string;
    headCheckpointId?: string;
    activeBranchName?: string;
    turnNumber?: number;
    messageHistory?: unknown[];
    // Story 10.1: layer-awareness fields
    currentLayerId?: string | null;
    layerStack?: { graphId: string; label: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ type: 'error', message: 'Invalid JSON body' }, { status: 400 });
  }

  const { userMessage, sessionId } = body;
  let { checkpoint, studioId } = body;

  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    return NextResponse.json(
      { type: 'error', message: 'userMessage is required' },
      { status: 400 }
    );
  }

  try {
    // If studioId provided but no checkpoint, load checkpoint from DB
    if (studioId && !checkpoint) {
      const stored = await studioPersistence.load(studioId);
      if (stored?.checkpoint) {
        checkpoint = stored.checkpoint;
      }
    }

    // If no studioId and no checkpoint (first message), create a new studio
    if (!studioId && !checkpoint) {
      const autoTitle =
        userMessage.trim().slice(0, 50) + (userMessage.trim().length > 50 ? '…' : '');
      studioId = await studioPersistence.create(workspaceId, autoTitle);
    }

    let outcome: Awaited<ReturnType<typeof startStudioSession>>;

    if (checkpoint) {
      // Resume existing session (Story 6.6: pass sessionId for SSE routing)
      outcome = await resumeStudioSession(checkpoint, userMessage.trim(), sessionId);
    } else {
      // Story 6.7: ensure BMAD session exists and load context for this workspace
      const sessionCtx = await sessionManager.loadContext(workspaceId);
      // Start new session (Story 6.6: pass sessionId; Story 6.7: pass sessionDir;
      // Story 10.1: pass layer fields)
      outcome = await startStudioSession(
        workspaceId,
        userMessage.trim(),
        sessionId,
        sessionCtx.sessionDir,
        {
          currentLayerId: body.currentLayerId ?? null,
          layerStack: body.layerStack ?? [],
        }
      );
    }

    const finalState = outcome.state as StudioSessionState;

    // Auto-save graph state + checkpoint to DB after every outcome
    // (messageHistory is saved separately by the client via PATCH)
    if (studioId) {
      await studioPersistence.saveTurn(studioId, {
        graphState: finalState,
        checkpoint: outcome.status === 'paused' ? outcome.checkpoint : null,
        sseSessionId: sessionId,
      });
    }

    // Create checkpoint node in the tree after each turn
    let newCheckpointInfo: { id: string; branchName: string; turnNumber: number } | null = null;
    if (studioId && outcome.status === 'paused') {
      const parentCheckpointId = body.headCheckpointId ?? null;
      const branchName = body.activeBranchName ?? 'main';

      let mermaidPreview: string | null = null;
      if (finalState.currentDiagram) {
        try {
          mermaidPreview = json2mermaid(finalState.currentDiagram);
        } catch {
          // Best-effort preview
        }
      }

      newCheckpointInfo = await checkpointPersistence.createCheckpoint(studioId, {
        parentId: parentCheckpointId,
        branchName,
        turnNumber: (body.turnNumber ?? 0) + 1,
        checkpoint: outcome.checkpoint,
        graphState: finalState,
        messageHistory: body.messageHistory,
        userMessage: userMessage.trim(),
        mermaidPreview,
      });

      await checkpointPersistence.updateHead(
        studioId,
        newCheckpointInfo.id,
        newCheckpointInfo.branchName
      );
    }

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

      // Auto-sync: create or update CanvasArtifact for this diagram
      const existingArtifact = await prisma.canvasArtifact.findFirst({
        where: { workspaceId, type: 'diagram', refId: diagram.id },
      });

      if (existingArtifact) {
        await prisma.canvasArtifact.update({
          where: { id: existingArtifact.id },
          data: { title: finalState.currentDiagram.title ?? 'Studio Diagram' },
        });
      } else {
        const unlinked = await prisma.canvasArtifact.findFirst({
          where: { workspaceId, type: 'diagram', refId: null },
          orderBy: { createdAt: 'asc' },
        });

        if (unlinked) {
          await prisma.canvasArtifact.update({
            where: { id: unlinked.id },
            data: {
              refId: diagram.id,
              title: finalState.currentDiagram.title ?? 'Studio Diagram',
            },
          });
        } else {
          const last = await prisma.canvasArtifact.findFirst({
            where: { workspaceId },
            orderBy: { y: 'desc' },
            select: { y: true, height: true },
          });
          const newY = last ? last.y + last.height + 40 : 40;

          await prisma.canvasArtifact.create({
            data: {
              workspaceId,
              type: 'diagram',
              refId: diagram.id,
              title: finalState.currentDiagram.title ?? 'Studio Diagram',
              x: 560,
              y: newY,
              width: 720,
              height: 640,
              zIndex: 0,
            },
          });
        }
      }

      // Story 6.7: persist artifacts to BMAD session filesystem
      await sessionManager.persistArtifacts(workspaceId, {
        diagramJson: JSON.stringify(finalState.currentDiagram),
        diagramMermaid: mermaidContent,
        version: diagram.id,
        state: { lastDiagramId: diagram.id },
      });

      // Mark studio as completed
      if (studioId) {
        await studioPersistence.complete(studioId, diagram.id);
      }

      return NextResponse.json({ type: 'complete', diagramId: diagram.id, studioId });
    }

    // Checkpoint tracking fields for client
    const cpPayload = newCheckpointInfo
      ? {
          headCheckpointId: newCheckpointInfo.id,
          activeBranchName: newCheckpointInfo.branchName,
          turnNumber: newCheckpointInfo.turnNumber,
        }
      : {};

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
          ...(finalState.mergedResponse ? { summary: finalState.mergedResponse } : {}),
          studioId,
          ...cpPayload,
        });
      }

      // Default: question pause (present-to-user node)
      // Story 6.4: include parsed persona messages when party mode is active
      const personasPayload =
        finalState.partyModeEnabled && finalState.personaMessages.length > 0
          ? { personas: finalState.personaMessages }
          : {};
      const roundtablePayload = finalState.roundtable ? { roundtable: finalState.roundtable } : {};

      return NextResponse.json({
        type: 'question',
        content: pendingRequest?.prompt ?? 'What would you like to design?',
        runId: outcome.runId,
        checkpoint: serializedCheckpoint,
        ...personasPayload,
        ...roundtablePayload,
        studioId,
        ...cpPayload,
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
