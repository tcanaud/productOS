import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { migrateV1ToCanvas } from '@/lib/canvas/migrate-v1';
import type { CanvasArtifact, CanvasConnection } from '@/lib/canvas/types';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Maps a Prisma CanvasArtifact row to the client-side type
 * (position fields flattened into a sub-object).
 */
function toClientArtifact(row: {
  id: string;
  workspaceId: string;
  type: string;
  refId: string | null;
  title: string | null;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}): CanvasArtifact {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type as CanvasArtifact['type'],
    refId: row.refId,
    title: row.title,
    zIndex: row.zIndex,
    position: { x: row.x, y: row.y, width: row.width, height: row.height },
  };
}

/**
 * GET /api/workspaces/[workspaceId]/canvas
 *
 * Returns the full canvas state: artifacts + connections.
 * Auto-seeds V1 default positions on first call (idempotent).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
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

  // Seed V1 default positions if this is the first canvas load
  const latestDiagram = await prisma.diagram.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  await migrateV1ToCanvas(workspaceId, { diagramId: latestDiagram?.id });

  const [artifactRows, connectionRows] = await Promise.all([
    prisma.canvasArtifact.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.canvasConnection.findMany({
      where: {
        source: { workspaceId },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Batch-fetch diagram content for preview enrichment (+1 query, no N+1)
  const diagramRefIds = artifactRows
    .filter((a) => a.type === 'diagram' && a.refId)
    .map((a) => a.refId as string);

  const diagrams =
    diagramRefIds.length > 0
      ? await prisma.diagram.findMany({
          where: { id: { in: diagramRefIds } },
          select: { id: true, content: true },
        })
      : [];

  const contentMap = new Map(diagrams.map((d) => [d.id, d.content]));

  // Batch-fetch studio data for preview enrichment
  const studioRefIds = artifactRows
    .filter((a) => a.type === 'studio' && a.refId)
    .map((a) => a.refId as string);

  const studioRows =
    studioRefIds.length > 0
      ? await prisma.studio.findMany({
          where: { id: { in: studioRefIds } },
          select: { id: true, title: true, status: true },
        })
      : [];

  const studioMap = new Map(studioRows.map((s) => [s.id, s]));

  const artifacts: CanvasArtifact[] = artifactRows.map((row) => {
    const base = toClientArtifact(row);
    if (row.type === 'diagram' && row.refId && contentMap.has(row.refId)) {
      base.preview = { mermaidContent: contentMap.get(row.refId)! };
    } else if (row.type === 'studio' && row.refId && studioMap.has(row.refId)) {
      const studio = studioMap.get(row.refId)!;
      base.title = studio.title;
      base.preview = { excerpt: studio.status };
    } else if (row.type === 'conversation') {
      base.preview = { excerpt: 'Studio conversation' };
    }
    return base;
  });

  const connections: CanvasConnection[] = connectionRows.map((c) => ({
    id: c.id,
    sourceId: c.sourceId,
    targetId: c.targetId,
    label: c.label,
  }));

  return NextResponse.json({ artifacts, connections });
}
