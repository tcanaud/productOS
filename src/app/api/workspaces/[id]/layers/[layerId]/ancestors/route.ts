import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { getLayer } from '@/lib/layer/layer-service';
import type { LayerEntry } from '@/hooks/useLayerNavigation';

type RouteParams = { params: Promise<{ id: string; layerId: string }> };

/**
 * GET /api/workspaces/[id]/layers/[layerId]/ancestors
 *
 * Story 9.3 — returns the full ancestor chain from root to the given layer (inclusive).
 * Used to reconstruct the Zustand layerStack on page load with ?layer=xyz.
 *
 * Response: LayerEntry[] ordered [root, ..., targetLayer]
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
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

  // Walk the parentGraphId chain from the target layer up to root
  const chain: LayerEntry[] = [];
  let currentId: string | null = layerId;

  while (currentId) {
    const layer = await getLayer(workspaceId, currentId);
    if (!layer) break;
    chain.unshift({ graphId: layer.id, label: layer.name });
    currentId = layer.parentGraphId ?? null;
  }

  if (chain.length === 0) {
    return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
  }

  return NextResponse.json(chain);
}
