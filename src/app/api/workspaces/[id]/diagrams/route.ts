import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

type RouteParams = { params: Promise<{ id: string }> };

const createDiagramSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(''),
  diagramType: z.enum(['flowchart', 'sequenceDiagram', 'stateDiagram']).default('flowchart'),
});

// POST /api/workspaces/:id/diagrams — create diagram
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

  const parsed = createDiagramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const diagram = await prisma.diagram.create({
    data: {
      workspaceId,
      title: parsed.data.title,
      content: parsed.data.content,
      diagramType: parsed.data.diagramType,
    },
  });

  return NextResponse.json(diagram, { status: 201 });
}

// GET /api/workspaces/:id/diagrams — list diagrams
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const diagrams = await prisma.diagram.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      diagramType: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(diagrams);
}
