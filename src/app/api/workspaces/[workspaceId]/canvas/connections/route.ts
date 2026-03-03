import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import type { CanvasConnection } from '@/lib/canvas/types';

type RouteParams = { params: Promise<{ workspaceId: string }> };

const CreateConnectionSchema = z.object({
  sourceId: z.string().min(1, 'sourceId is required'),
  targetId: z.string().min(1, 'targetId is required'),
  label: z.string().max(200).optional().nullable(),
});

/**
 * POST /api/workspaces/[workspaceId]/canvas/connections
 *
 * Creates a directed connection between two canvas artifacts.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { workspaceId } = await params;

  // Verify membership
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

  const parsed = CreateConnectionSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { sourceId, targetId, label } = parsed.data;

  // Verify both artifacts belong to this workspace
  const [source, target] = await Promise.all([
    prisma.canvasArtifact.findFirst({ where: { id: sourceId, workspaceId } }),
    prisma.canvasArtifact.findFirst({ where: { id: targetId, workspaceId } }),
  ]);

  if (!source) {
    return NextResponse.json({ error: 'Source artifact not found' }, { status: 404 });
  }
  if (!target) {
    return NextResponse.json({ error: 'Target artifact not found' }, { status: 404 });
  }

  const row = await prisma.canvasConnection.create({
    data: { sourceId, targetId, label: label ?? null },
  });

  const connection: CanvasConnection = {
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
    label: row.label,
  };

  return NextResponse.json(connection, { status: 201 });
}
