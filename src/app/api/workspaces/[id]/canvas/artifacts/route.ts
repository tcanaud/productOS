import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import type { CanvasArtifact } from '@/lib/canvas/types';

type RouteParams = { params: Promise<{ id: string }> };

const ARTIFACT_TYPES = ['diagram', 'conversation', 'review', 'spec', 'story', 'note'] as const;

const CreateArtifactSchema = z.object({
  type: z.enum(ARTIFACT_TYPES),
  refId: z.string().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().min(1).default(480),
  height: z.number().min(1).default(360),
  zIndex: z.number().int().default(0),
});

/**
 * POST /api/workspaces/[workspaceId]/canvas/artifacts
 *
 * Creates a new canvas artifact with position metadata.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId } = await params;

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

  const parsed = CreateArtifactSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { type, refId, title, x, y, width, height, zIndex } = parsed.data;

  const row = await prisma.canvasArtifact.create({
    data: {
      workspaceId,
      type,
      refId: refId ?? null,
      title: title ?? null,
      x,
      y,
      width,
      height,
      zIndex,
    },
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

  return NextResponse.json(artifact, { status: 201 });
}
