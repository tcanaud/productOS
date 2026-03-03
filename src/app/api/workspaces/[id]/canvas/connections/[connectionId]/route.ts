import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

type RouteParams = { params: Promise<{ workspaceId: string; connectionId: string }> };

/**
 * DELETE /api/workspaces/[workspaceId]/canvas/connections/[connectionId]
 *
 * Removes a connection between two canvas artifacts.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { workspaceId, connectionId } = await params;

  // Verify membership
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Verify connection exists and belongs to this workspace (via source artifact)
  const connection = await prisma.canvasConnection.findFirst({
    where: {
      id: connectionId,
      source: { workspaceId },
    },
  });
  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  await prisma.canvasConnection.delete({ where: { id: connectionId } });

  return new NextResponse(null, { status: 204 });
}
