import { prisma } from '@/lib/prisma';
import type { LayerGraph } from '@/generated/prisma/client';
import { SOFT_LIMITS, type LayerGraphRecord, type SoftLimitWarnings } from './types';
import { wouldCreateCycle } from './cycle-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type LayerGraphWithChildren = LayerGraph & { children?: LayerGraphWithChildren[] };

function toRecord(row: LayerGraphWithChildren): LayerGraphRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    parentNodeId: row.parentNodeId,
    parentGraphId: row.parentGraphId,
    depth: row.depth,
    ports: row.ports as unknown as LayerGraphRecord['ports'],
    graph: row.graph as object,
    summary: row.summary,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    children: (row.children ?? []).map((c: LayerGraphWithChildren) => toRecord(c)),
  };
}

function checkSoftLimits(depth: number, ports: unknown[], graph: object): SoftLimitWarnings {
  const warnings: SoftLimitWarnings = {};

  if (depth > SOFT_LIMITS.depth) warnings.depthExceeded = true;
  if (ports.length > SOFT_LIMITS.ports) warnings.portsExceeded = true;

  const g = graph as Record<string, unknown>;
  const nodes = Array.isArray(g.nodes) ? (g.nodes as unknown[]) : [];
  const composites = nodes.filter((n) => (n as Record<string, unknown>).type === 'composite');

  if (nodes.length > SOFT_LIMITS.nodes) warnings.nodesExceeded = true;
  if (composites.length > SOFT_LIMITS.composites) warnings.compositesExceeded = true;

  return warnings;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/** Create a root layer (depth 0, no parent). */
export async function createRoot(
  workspaceId: string,
  name: string,
  description?: string
): Promise<LayerGraphRecord> {
  const row = await prisma.layerGraph.create({
    data: {
      workspaceId,
      name,
      description: description ?? null,
      depth: 0,
    },
  });
  return toRecord(row);
}

/**
 * Create a child layer under `parentId`.
 * Pass `candidateId` when reparenting an existing layer to enable cycle detection.
 */
export async function createChild(
  workspaceId: string,
  parentId: string,
  name: string,
  parentNodeId: string,
  description?: string,
  candidateId?: string
): Promise<{ layer: LayerGraphRecord; warnings: SoftLimitWarnings }> {
  const parent = await prisma.layerGraph.findFirst({
    where: { id: parentId, workspaceId, deletedAt: null },
  });
  if (!parent) {
    throw Object.assign(new Error('Parent layer not found'), { status: 404 });
  }

  if (candidateId) {
    const cycle = await wouldCreateCycle(prisma, parentId, candidateId);
    if (cycle) {
      throw Object.assign(
        new Error('Cycle detected: candidate layer already appears in the ancestor chain.'),
        { status: 400 }
      );
    }
  }

  const depth = parent.depth + 1;
  const row = await prisma.layerGraph.create({
    data: {
      workspaceId,
      name,
      description: description ?? null,
      parentGraphId: parentId,
      parentNodeId,
      depth,
    },
  });

  const warnings = checkSoftLimits(depth, [], {});
  return { layer: toRecord(row), warnings };
}

/** Get a single non-deleted layer. Returns null if not found. */
export async function getLayer(
  workspaceId: string,
  layerId: string
): Promise<LayerGraphRecord | null> {
  const row = await prisma.layerGraph.findFirst({
    where: { id: layerId, workspaceId, deletedAt: null },
  });
  return row ? toRecord(row) : null;
}

/** List all non-deleted root layers with their children tree (up to 3 levels). */
export async function listRootLayers(workspaceId: string): Promise<LayerGraphRecord[]> {
  const rows = await prisma.layerGraph.findMany({
    where: { workspaceId, parentGraphId: null, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      children: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: {
          children: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
  return rows.map((r) => toRecord(r as LayerGraphWithChildren));
}

/** Update allowed fields, always nulling summary (cache invalidation). */
export async function updateLayer(
  workspaceId: string,
  layerId: string,
  patch: {
    name?: string;
    description?: string | null;
    ports?: unknown[];
    graph?: Record<string, unknown>;
  }
): Promise<{ layer: LayerGraphRecord; warnings: SoftLimitWarnings }> {
  const existing = await prisma.layerGraph.findFirst({
    where: { id: layerId, workspaceId, deletedAt: null },
  });
  if (!existing) {
    throw Object.assign(new Error('Layer not found'), { status: 404 });
  }

  const newPorts = patch.ports ?? (existing.ports as unknown[]);
  const newGraph = patch.graph ?? (existing.graph as object);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { summary: null };
  if (patch.name !== undefined) updateData.name = patch.name;
  if (patch.description !== undefined) updateData.description = patch.description;
  if (patch.ports !== undefined) updateData.ports = patch.ports;
  if (patch.graph !== undefined) updateData.graph = patch.graph;

  const row = await prisma.layerGraph.update({
    where: { id: layerId },
    data: updateData,
  });

  const warnings = checkSoftLimits(row.depth, newPorts as unknown[], newGraph);
  return { layer: toRecord(row), warnings };
}

/** Soft-delete a layer by setting deletedAt. */
export async function softDeleteLayer(workspaceId: string, layerId: string): Promise<void> {
  const existing = await prisma.layerGraph.findFirst({
    where: { id: layerId, workspaceId, deletedAt: null },
  });
  if (!existing) {
    throw Object.assign(new Error('Layer not found'), { status: 404 });
  }

  await prisma.layerGraph.update({
    where: { id: layerId },
    data: { deletedAt: new Date() },
  });
}
