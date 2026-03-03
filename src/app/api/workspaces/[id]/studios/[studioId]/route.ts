import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { studioPersistence } from '@/lib/studio/studio-persistence';

type RouteParams = { params: Promise<{ id: string; studioId: string }> };

/**
 * GET /api/workspaces/[id]/studios/[studioId]
 *
 * Returns full studio state for hydration.
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

  const studio = await studioPersistence.load(studioId);
  if (!studio) {
    return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
  }

  // Verify studio belongs to this workspace
  const studioRow = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { workspaceId: true },
  });
  if (studioRow?.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
  }

  return NextResponse.json(studio);
}

/**
 * PATCH /api/workspaces/[id]/studios/[studioId]
 *
 * Saves messageHistory (called by the client after SSE events settle).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

  // Verify studio belongs to this workspace
  const studioRow = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { workspaceId: true },
  });
  if (studioRow?.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
  }

  let body: { messageHistory?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.messageHistory && Array.isArray(body.messageHistory)) {
    await studioPersistence.saveMessages(studioId, body.messageHistory);
  }

  return NextResponse.json({ ok: true });
}
