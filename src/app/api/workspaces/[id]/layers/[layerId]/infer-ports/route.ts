import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { inferPortsFromContext } from '@/lib/layer/port-inference';
import type { JsonGraph } from '@/lib/json2mermaid/types';

type RouteParams = { params: Promise<{ id: string; layerId: string }> };

const InferPortsSchema = z.object({
  nodeId: z.string().min(1),
  parentGraphId: z.string().min(1),
});

/**
 * POST /api/workspaces/[id]/layers/[layerId]/infer-ports
 *
 * Analyzes the edges connected to `nodeId` in `parentGraphId` and returns
 * AI-inferred port suggestions as a non-destructive preview.
 *
 * Body: { nodeId: string; parentGraphId: string }
 * Response: { ports: InferredPort[]; consolidationWarning: boolean; consolidatedFrom?: number }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id: workspaceId, layerId } = await params;

  // Verify workspace membership
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Verify the child layer belongs to this workspace (ownership check)
  const childLayer = await prisma.layerGraph.findFirst({
    where: { id: layerId, workspaceId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!childLayer) {
    return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = InferPortsSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { nodeId, parentGraphId } = parsed.data;

  // Fetch parent layer graph — validate it belongs to the same workspace
  const parentLayer = await prisma.layerGraph.findFirst({
    where: { id: parentGraphId, workspaceId, deletedAt: null },
    select: { id: true, name: true, graph: true },
  });
  if (!parentLayer) {
    return NextResponse.json({ error: 'Parent layer not found' }, { status: 404 });
  }

  const parentGraph = parentLayer.graph as unknown as JsonGraph;

  // Verify nodeId exists in the parent graph
  const graphNodes = parentGraph?.nodes ?? [];
  const targetNode = graphNodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return NextResponse.json({ error: 'Node not found in parent graph' }, { status: 404 });
  }

  const nodeName = targetNode.label ?? childLayer.name;

  try {
    const result = await inferPortsFromContext(nodeId, parentGraph, nodeName);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[infer-ports] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
