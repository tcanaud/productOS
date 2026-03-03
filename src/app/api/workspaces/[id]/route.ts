import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { sessionManager } from '@/lib/session/session-manager';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id — get workspace details
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      members: { some: { userId: user.id } },
    },
    include: {
      members: { select: { userId: true, role: true } },
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json(workspace);
}

// PATCH /api/workspaces/:id — update workspace
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id } = await params;

  // Only owner can update
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: user.id, role: 'owner' },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data: { name?: string; description?: string } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    if (body.name.trim().length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.description !== undefined) {
    data.description = body.description?.trim() ?? null;
  }

  const workspace = await prisma.workspace.update({
    where: { id },
    data,
  });

  return NextResponse.json(workspace);
}

// DELETE /api/workspaces/:id — delete workspace
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id } = await params;

  // Only owner can delete
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: user.id, role: 'owner' },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Story 6.7: Remove session filesystem dir before workspace deletion (idempotent)
  await sessionManager.deleteSession(id);

  // Delete members first (FK constraint), then workspace
  await prisma.workspaceMember.deleteMany({ where: { workspaceId: id } });
  await prisma.workspace.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
