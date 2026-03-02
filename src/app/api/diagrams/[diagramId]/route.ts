import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

type RouteParams = { params: Promise<{ diagramId: string }> };

const updateDiagramSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  diagramType: z.enum(['flowchart', 'sequenceDiagram', 'stateDiagram']).optional(),
});

const MAX_VERSIONS = 50;

async function getDiagramForUser(diagramId: string, userId: string) {
  const diagram = await prisma.diagram.findFirst({
    where: {
      id: diagramId,
      workspace: { members: { some: { userId } } },
    },
  });
  return diagram;
}

// GET /api/diagrams/:diagramId — get diagram with content
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { diagramId } = await params;

  const diagram = await getDiagramForUser(diagramId, user.id);
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found' }, { status: 404 });
  }

  return NextResponse.json(diagram);
}

// PATCH /api/diagrams/:diagramId — update diagram content (autosave)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { diagramId } = await params;

  const diagram = await getDiagramForUser(diagramId, user.id);
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateDiagramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: { title?: string; content?: string; diagramType?: string } = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.content !== undefined) data.content = parsed.data.content;
  if (parsed.data.diagramType !== undefined) data.diagramType = parsed.data.diagramType;

  const updated = await prisma.diagram.update({
    where: { id: diagramId },
    data,
  });

  // If content changed, create a new version
  if (parsed.data.content !== undefined && parsed.data.content !== diagram.content) {
    await prisma.diagramVersion.create({
      data: {
        diagramId,
        content: parsed.data.content,
        authorId: user.id,
      },
    });

    // Enforce version cap: delete oldest versions beyond MAX_VERSIONS
    const versionCount = await prisma.diagramVersion.count({ where: { diagramId } });
    if (versionCount > MAX_VERSIONS) {
      const oldest = await prisma.diagramVersion.findMany({
        where: { diagramId },
        orderBy: { createdAt: 'asc' },
        take: versionCount - MAX_VERSIONS,
        select: { id: true },
      });
      await prisma.diagramVersion.deleteMany({
        where: { id: { in: oldest.map((v) => v.id) } },
      });
    }
  }

  return NextResponse.json(updated);
}
