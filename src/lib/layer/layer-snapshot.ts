/**
 * layer-snapshot.ts — Story 11.2
 *
 * Serialize and restore the full set of LayerGraphs for a workspace.
 * Used by the atomic restructure apply to create pre-restructure checkpoints.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { LayerGraphRecord } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToRecord(row: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  parentNodeId: string | null;
  parentGraphId: string | null;
  depth: number;
  ports: unknown;
  graph: unknown;
  summary: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): LayerGraphRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    parentNodeId: row.parentNodeId,
    parentGraphId: row.parentGraphId,
    depth: row.depth,
    ports: row.ports as LayerGraphRecord['ports'],
    graph: row.graph as object,
    summary: row.summary,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Snapshot all non-deleted LayerGraphs for a workspace.
 * Returns a plain array suitable for JSON serialization in a StudioCheckpoint.
 */
export async function snapshotLayers(workspaceId: string): Promise<LayerGraphRecord[]> {
  const rows = await prisma.layerGraph.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(rowToRecord);
}

/**
 * Restore LayerGraphs from a snapshot.
 *
 * Strategy:
 *   1. Soft-delete all current non-deleted layers.
 *   2. Upsert each snapshot record (create if not exists, restore if soft-deleted).
 *
 * All operations run in a single Prisma transaction.
 */
export async function restoreLayerGraphsFromSnapshot(
  workspaceId: string,
  snapshot: LayerGraphRecord[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Soft-delete all current live layers for this workspace
    await tx.layerGraph.updateMany({
      where: { workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Restore each snapshot record in creation order (parents before children)
    for (const record of snapshot) {
      await tx.layerGraph.upsert({
        where: { id: record.id },
        create: {
          id: record.id,
          workspaceId: record.workspaceId,
          name: record.name,
          description: record.description,
          parentNodeId: record.parentNodeId,
          parentGraphId: record.parentGraphId,
          depth: record.depth,
          ports: record.ports as unknown as Prisma.InputJsonValue,
          graph: record.graph as unknown as Prisma.InputJsonValue,
          summary: record.summary,
          deletedAt: null,
          createdAt: record.createdAt,
        },
        update: {
          name: record.name,
          description: record.description,
          parentNodeId: record.parentNodeId,
          parentGraphId: record.parentGraphId,
          depth: record.depth,
          ports: record.ports as unknown as Prisma.InputJsonValue,
          graph: record.graph as unknown as Prisma.InputJsonValue,
          summary: record.summary,
          deletedAt: null,
        },
      });
    }
  });
}
