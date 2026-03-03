import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { checkpointPersistence } from '@/lib/studio/checkpoint-persistence';

type RouteParams = {
  params: Promise<{ id: string; studioId: string; checkpointId: string }>;
};

/**
 * POST /api/workspaces/[id]/studios/[studioId]/checkpoints/[checkpointId]/fork
 *
 * Creates a new Studio forked from this checkpoint.
 * Request body: { title?: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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

  // Verify checkpoint belongs to this studio
  const cpRow = await prisma.studioCheckpoint.findUnique({
    where: { id: checkpointId },
    select: { studioId: true },
  });
  if (cpRow?.studioId !== studioId) {
    return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });
  }

  let body: { title?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const title = body.title || 'Forked Studio';

  const result = await checkpointPersistence.forkStudio(workspaceId, checkpointId, title);

  return NextResponse.json({
    studioId: result.studioId,
    checkpointId: result.checkpointId,
  });
}
