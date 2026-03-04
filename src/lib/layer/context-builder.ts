/**
 * Layer Context Builder — Story 10.1
 *
 * Builds a `LayerContext` object describing the current layer's position
 * in the hierarchy, for injection into the AI refinement prompt.
 *
 * NFR-L2: ancestor summaries capped at 2 levels (grandparent + great-grandparent).
 */
import { prisma } from '@/lib/prisma';
import type { LayerPort } from './types';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import { generateAndCacheSummary } from './summary-generator';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface LayerContextCurrent {
  id: string;
  name: string;
  depth: number;
  ports: LayerPort[];
  graph: JsonGraph;
}

export interface LayerContextParent {
  id: string;
  name: string;
  ports: LayerPort[];
  /** Other children of the same parent (siblings), excluding the current layer. */
  siblings: { id: string; name: string; summary: string | null }[];
}

export interface LayerContextAncestor {
  id: string;
  name: string;
  depth: number;
  /** Always non-null — generated on cache-miss via summary-generator.ts. */
  summary: string;
}

export interface LayerContextChild {
  id: string;
  name: string;
  ports: LayerPort[];
}

export interface LayerContext {
  current: LayerContextCurrent;
  /** null for root layers (depth === 0). */
  parent: LayerContextParent | null;
  /** Grandparent and beyond, max 2 entries (NFR-L2). */
  ancestors: LayerContextAncestor[];
  children: LayerContextChild[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: read or generate a layer summary
// ─────────────────────────────────────────────────────────────────────────────

async function getOrGenerateSummary(
  workspaceId: string,
  layer: { id: string; name: string; summary: string | null; graph: object }
): Promise<string> {
  if (layer.summary) return layer.summary;
  // Cache miss — generate via Haiku and persist
  return generateAndCacheSummary(workspaceId, layer.id, layer.graph as JsonGraph, layer.name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full LayerContext for a given layer.
 * Returns null if the layer is not found (graceful degradation).
 */
export async function buildLayerContext(
  workspaceId: string,
  layerGraphId: string
): Promise<LayerContext | null> {
  // ── 1. Fetch current layer ───────────────────────────────────────────────
  const current = await prisma.layerGraph.findFirst({
    where: { id: layerGraphId, workspaceId, deletedAt: null },
  });

  if (!current) return null;

  const currentCtx: LayerContextCurrent = {
    id: current.id,
    name: current.name,
    depth: current.depth,
    ports: (current.ports as unknown as LayerPort[]) ?? [],
    graph: (current.graph as unknown as JsonGraph) ?? {
      diagramType: 'flowchart',
      nodes: [],
      edges: [],
    },
  };

  // ── 2. Fetch direct children (names + ports only) ────────────────────────
  const childRows = await prisma.layerGraph.findMany({
    where: { parentGraphId: layerGraphId, workspaceId, deletedAt: null },
    select: { id: true, name: true, ports: true },
    orderBy: { createdAt: 'asc' },
  });

  const children: LayerContextChild[] = childRows.map((c) => ({
    id: c.id,
    name: c.name,
    ports: (c.ports as unknown as LayerPort[]) ?? [],
  }));

  // ── 3. Fetch parent + siblings ───────────────────────────────────────────
  let parent: LayerContextParent | null = null;

  if (current.parentGraphId) {
    const parentRow = await prisma.layerGraph.findFirst({
      where: { id: current.parentGraphId, workspaceId, deletedAt: null },
    });

    if (parentRow) {
      // Siblings = other children of the same parent
      const siblingRows = await prisma.layerGraph.findMany({
        where: {
          parentGraphId: current.parentGraphId,
          workspaceId,
          deletedAt: null,
          id: { not: layerGraphId },
        },
        select: { id: true, name: true, summary: true },
        orderBy: { createdAt: 'asc' },
      });

      parent = {
        id: parentRow.id,
        name: parentRow.name,
        ports: (parentRow.ports as unknown as LayerPort[]) ?? [],
        siblings: siblingRows.map((s) => ({
          id: s.id,
          name: s.name,
          summary: s.summary,
        })),
      };
    }
  }

  // ── 4. Walk ancestors beyond parent (max 2, NFR-L2) ─────────────────────
  const ancestors: LayerContextAncestor[] = [];

  if (current.parentGraphId) {
    // Find grandparent: parent of parent
    const parentRow = await prisma.layerGraph.findFirst({
      where: { id: current.parentGraphId, workspaceId, deletedAt: null },
      select: { parentGraphId: true },
    });

    let nextAncestorId = parentRow?.parentGraphId ?? null;
    let levelsCollected = 0;

    while (nextAncestorId && levelsCollected < 2) {
      const ancestorRow = await prisma.layerGraph.findFirst({
        where: { id: nextAncestorId, workspaceId, deletedAt: null },
        select: {
          id: true,
          name: true,
          depth: true,
          summary: true,
          graph: true,
          parentGraphId: true,
        },
      });

      if (!ancestorRow) break;

      const summary = await getOrGenerateSummary(workspaceId, {
        id: ancestorRow.id,
        name: ancestorRow.name,
        summary: ancestorRow.summary,
        graph: ancestorRow.graph as object,
      });

      ancestors.push({
        id: ancestorRow.id,
        name: ancestorRow.name,
        depth: ancestorRow.depth,
        summary,
      });

      nextAncestorId = ancestorRow.parentGraphId;
      levelsCollected++;
    }
  }

  return {
    current: currentCtx,
    parent,
    ancestors,
    children,
  };
}
