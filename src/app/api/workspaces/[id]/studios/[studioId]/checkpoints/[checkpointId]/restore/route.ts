import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { checkpointPersistence } from '@/lib/studio/checkpoint-persistence';

type RouteParams = {
  params: Promise<{ id: string; studioId: string; checkpointId: string }>;
};

/**
 * POST /api/workspaces/[id]/studios/[studioId]/checkpoints/[checkpointId]/restore
 *
 * Restores a checkpoint: loads full state, updates Studio head pointer.
 * Returns checkpoint, graphState, messageHistory, mermaidPreview.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId, studioId, checkpointId } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Verify studio belongs to this workspace
  const studioRow = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { workspaceId: true },
  });
  if (studioRow?.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
  }

  // Load the full checkpoint
  const cp = await checkpointPersistence.getCheckpoint(checkpointId);
  if (!cp) {
    return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });
  }

  // Verify checkpoint belongs to this studio
  const cpRow = await prisma.studioCheckpoint.findUnique({
    where: { id: checkpointId },
    select: { studioId: true },
  });
  if (cpRow?.studioId !== studioId) {
    return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });
  }

  // Update head pointer
  await checkpointPersistence.updateHead(studioId, checkpointId, cp.branchName);

  // Also update the Studio's live graphState and checkpoint for consistency
  await prisma.studio.update({
    where: { id: studioId },
    data: {
      graphState: cp.graphState as Prisma.InputJsonValue,
      checkpoint: cp.checkpoint as Prisma.InputJsonValue,
      messageHistory: cp.messageHistory
        ? (cp.messageHistory as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });

  return NextResponse.json({
    checkpoint: cp.checkpoint,
    graphState: cp.graphState,
    messageHistory: cp.messageHistory,
    mermaidPreview: cp.mermaidPreview,
    headCheckpointId: cp.id,
    activeBranchName: cp.branchName,
    turnNumber: cp.turnNumber,
  });
}
