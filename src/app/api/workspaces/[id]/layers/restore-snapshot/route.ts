/**
 * POST /api/workspaces/[id]/layers/restore-snapshot — Story 11.2
 *
 * Restores all LayerGraphs for a workspace from a pre-restructure snapshot
 * stored in a StudioCheckpoint's `graphState` field.
 *
 * Request body:
 *   { checkpointId: string }
 *
 * Response:
 *   { restored: number } — count of LayerGraph rows restored
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { restoreLayerGraphsFromSnapshot } from '@/lib/layer/layer-snapshot';
import type { LayerGraphRecord } from '@/lib/layer/types';

type RouteParams = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  checkpointId: z.string().min(1, 'checkpointId is required'),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId } = await params;

  // Verify workspace membership
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { checkpointId } = parsed.data;

  // Load the checkpoint
  const checkpoint = await prisma.studioCheckpoint.findUnique({
    where: { id: checkpointId },
    select: {
      id: true,
      userMessage: true,
      graphState: true,
      studio: { select: { workspaceId: true } },
    },
  });

  if (!checkpoint) {
    return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });
  }

  // Verify the checkpoint belongs to this workspace
  if (checkpoint.studio.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });
  }

  // Validate graphState is a LayerGraphRecord array snapshot
  const snapshot = checkpoint.graphState;
  if (!Array.isArray(snapshot)) {
    return NextResponse.json(
      { error: 'Checkpoint graphState is not a layer snapshot' },
      { status: 400 }
    );
  }

  try {
    await restoreLayerGraphsFromSnapshot(workspaceId, snapshot as unknown as LayerGraphRecord[]);
    return NextResponse.json({ restored: snapshot.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Restore failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
