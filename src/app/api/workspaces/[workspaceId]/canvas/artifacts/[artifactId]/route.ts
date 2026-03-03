import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import type { CanvasArtifact } from '@/lib/canvas/types';

type RouteParams = { params: Promise<{ workspaceId: string; artifactId: string }> };

const UpdateArtifactSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(1).optional(),
  height: z.number().min(1).optional(),
  zIndex: z.number().int().optional(),
});

/**
 * PATCH /api/workspaces/[workspaceId]/canvas/artifacts/[artifactId]
 *
 * Updates position (x, y, width, height), zIndex, or title of a canvas artifact.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { workspaceId, artifactId } = await params;

  // Verify membership
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Verify artifact belongs to workspace
  const existing = await prisma.canvasArtifact.findFirst({
    where: { id: artifactId, workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateArtifactSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.x !== undefined) data.x = parsed.data.x;
  if (parsed.data.y !== undefined) data.y = parsed.data.y;
  if (parsed.data.width !== undefined) data.width = parsed.data.width;
  if (parsed.data.height !== undefined) data.height = parsed.data.height;
  if (parsed.data.zIndex !== undefined) data.zIndex = parsed.data.zIndex;

  const row = await prisma.canvasArtifact.update({
    where: { id: artifactId },
    data,
  });

  const artifact: CanvasArtifact = {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type as CanvasArtifact['type'],
    refId: row.refId,
    title: row.title,
    zIndex: row.zIndex,
    position: { x: row.x, y: row.y, width: row.width, height: row.height },
  };

  return NextResponse.json(artifact);
}
