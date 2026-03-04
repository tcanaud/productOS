import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { createChild } from '@/lib/layer/layer-service';

type RouteParams = { params: Promise<{ id: string; layerId: string }> };

const CreateChildSchema = z.object({
  name: z.string().min(1).max(200),
  parentNodeId: z.string().min(1),
  description: z.string().max(1000).optional(),
  candidateId: z.string().optional(), // provided when reparenting an existing layer
});

/**
 * POST /api/workspaces/[id]/layers/[layerId]/child
 *
 * Creates a child LayerGraph under the given parent.
 * Returns 400 if the operation would create a cycle.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId, layerId: parentId } = await params;

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

  const parsed = CreateChildSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { name, parentNodeId, description, candidateId } = parsed.data;

  try {
    const { layer, warnings } = await createChild(
      workspaceId,
      parentId,
      name,
      parentNodeId,
      description,
      candidateId
    );
    return NextResponse.json({ layer, warnings }, { status: 201 });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e.status === 400) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
