import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

type RouteParams = { params: Promise<{ diagramId: string; versionId: string }> };

// POST /api/diagrams/:diagramId/versions/:versionId/restore — restore a version
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { diagramId, versionId } = await params;

  const diagram = await prisma.diagram.findFirst({
    where: {
      id: diagramId,
      workspace: { members: { some: { userId: user.id } } },
    },
  });
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found' }, { status: 404 });
  }

  const version = await prisma.diagramVersion.findFirst({
    where: { id: versionId, diagramId },
  });
  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  // Restore: update diagram content to the version's content and create a new version entry
  const updated = await prisma.diagram.update({
    where: { id: diagramId },
    data: { content: version.content },
  });

  await prisma.diagramVersion.create({
    data: {
      diagramId,
      content: version.content,
      authorId: user.id,
    },
  });

  return NextResponse.json(updated);
}
