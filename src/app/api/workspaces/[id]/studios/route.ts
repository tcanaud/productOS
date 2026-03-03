import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { studioPersistence } from '@/lib/studio/studio-persistence';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]/studios
 *
 * Lists all studios for a workspace, sorted by updatedAt desc.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const studios = await studioPersistence.list(workspaceId);
  return NextResponse.json({ studios });
}
