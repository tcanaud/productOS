import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { getLayer, updateLayer, softDeleteLayer } from '@/lib/layer/layer-service';

type RouteParams = { params: Promise<{ id: string; layerId: string }> };

const UpdateLayerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  ports: z.array(z.unknown()).optional(),
  graph: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/workspaces/[id]/layers/[layerId]
 *
 * Returns the layer graph with ports and graph data.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId, layerId } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const layer = await getLayer(workspaceId, layerId);
  if (!layer) {
    return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
  }

  return NextResponse.json({ layer });
}

/**
 * PATCH /api/workspaces/[id]/layers/[layerId]
 *
 * Updates allowed fields and nulls summary (cache invalidation).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId, layerId } = await params;

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

  const parsed = UpdateLayerSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  try {
    const { layer, warnings } = await updateLayer(workspaceId, layerId, parsed.data);
    return NextResponse.json({ layer, warnings });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/workspaces/[id]/layers/[layerId]
 *
 * Soft-deletes the layer (sets deletedAt = now).
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId, layerId } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  try {
    await softDeleteLayer(workspaceId, layerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
