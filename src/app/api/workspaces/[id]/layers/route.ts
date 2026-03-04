import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { createRoot, listRootLayers } from '@/lib/layer/layer-service';

type RouteParams = { params: Promise<{ id: string }> };

const CreateRootSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

/**
 * GET /api/workspaces/[id]/layers
 *
 * Returns all non-deleted root LayerGraphs with their children tree.
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

  const layers = await listRootLayers(workspaceId);
  return NextResponse.json({ layers });
}

/**
 * POST /api/workspaces/[id]/layers
 *
 * Creates a root LayerGraph (depth 0, no parent).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateRootSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const layer = await createRoot(workspaceId, parsed.data.name, parsed.data.description);
  return NextResponse.json({ layer }, { status: 201 });
}
