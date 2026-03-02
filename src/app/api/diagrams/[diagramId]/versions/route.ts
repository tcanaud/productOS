import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

type RouteParams = { params: Promise<{ diagramId: string }> };

// GET /api/diagrams/:diagramId/versions — list version history
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { diagramId } = await params;

  const diagram = await prisma.diagram.findFirst({
    where: {
      id: diagramId,
      workspace: { members: { some: { userId: user.id } } },
    },
  });
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found' }, { status: 404 });
  }

  const versions = await prisma.diagramVersion.findMany({
    where: { diagramId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      authorId: true,
      createdAt: true,
    },
  });

  return NextResponse.json(versions);
}
