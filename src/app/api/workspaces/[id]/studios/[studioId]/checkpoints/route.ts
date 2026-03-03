import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { checkpointPersistence } from '@/lib/studio/checkpoint-persistence';

type RouteParams = { params: Promise<{ id: string; studioId: string }> };

/**
 * GET /api/workspaces/[id]/studios/[studioId]/checkpoints
 *
 * Returns the lightweight checkpoint tree (no full blobs).
 * Includes lazy migration: if tree is empty but studio has checkpoint data,
 * creates a root checkpoint node automatically.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId, studioId } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Verify studio belongs to this workspace and load head info
  const studioRow = await prisma.studio.findUnique({
    where: { id: studioId },
    select: {
      workspaceId: true,
      headCheckpointId: true,
      activeBranchName: true,
      checkpoint: true,
      graphState: true,
      messageHistory: true,
    },
  });
  if (studioRow?.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
  }

  let tree = await checkpointPersistence.getTree(studioId);
  let headCheckpointId = studioRow.headCheckpointId;
  const activeBranchName = studioRow.activeBranchName;

  // Lazy migration: if tree is empty but studio has valid checkpoint data,
  // create an initial root checkpoint node from the current studio state
  if (tree.length === 0 && studioRow.checkpoint && studioRow.graphState) {
    const rootCp = await checkpointPersistence.createCheckpoint(studioId, {
      parentId: null,
      branchName: 'main',
      turnNumber: 0,
      checkpoint: studioRow.checkpoint,
      graphState: studioRow.graphState,
      messageHistory: studioRow.messageHistory as unknown[] | undefined,
      userMessage: 'Initial state',
    });

    await checkpointPersistence.updateHead(studioId, rootCp.id, rootCp.branchName);
    headCheckpointId = rootCp.id;
    tree = await checkpointPersistence.getTree(studioId);
  }

  return NextResponse.json({
    tree,
    headCheckpointId,
    activeBranchName,
  });
}
