/**
 * patch-applier.ts — Story 6.5: Iterative Diagram Refinement via Chat
 *
 * Pure function that applies a DiagramPatch to a JsonGraph.
 * Returns a new JsonGraph without mutating the input.
 *
 * Application order: removeNodes → removeEdges → modifyNodes → addNodes → addEdges
 */
import type { JsonGraph, NodeShape } from '@/lib/json2mermaid/types';
import type { DiagramPatch } from './studio-session.types';

/**
 * Apply a DiagramPatch to an existing JsonGraph.
 *
 * @param graph - The current graph (source of truth). Not mutated.
 * @param patch - The patch to apply.
 * @returns A new JsonGraph with the patch applied.
 */
export function applyPatch(graph: JsonGraph, patch: DiagramPatch): JsonGraph {
  // Fast path: empty patch → return original reference unchanged
  const hasChanges =
    (patch.removeNodes?.length ?? 0) > 0 ||
    (patch.removeEdges?.length ?? 0) > 0 ||
    (patch.modifyNodes?.length ?? 0) > 0 ||
    (patch.addNodes?.length ?? 0) > 0 ||
    (patch.addEdges?.length ?? 0) > 0;

  if (!hasChanges) return graph;

  let nodes = [...graph.nodes];
  let edges = [...graph.edges];

  // 1. removeNodes — cascade to edges
  if (patch.removeNodes && patch.removeNodes.length > 0) {
    const removeSet = new Set(patch.removeNodes);
    nodes = nodes.filter((n) => !removeSet.has(n.id));
    edges = edges.filter((e) => !removeSet.has(e.from) && !removeSet.has(e.to));
  }

  // 2. removeEdges — by edge id (edges must have an 'id' field or we skip)
  if (patch.removeEdges && patch.removeEdges.length > 0) {
    const removeEdgeSet = new Set(patch.removeEdges);
    edges = edges.filter((e) => {
      return e.id === undefined || !removeEdgeSet.has(e.id);
    });
  }

  // 3. modifyNodes — shallow merge
  if (patch.modifyNodes && patch.modifyNodes.length > 0) {
    for (const mod of patch.modifyNodes) {
      const idx = nodes.findIndex((n) => n.id === mod.id);
      if (idx !== -1) {
        nodes[idx] = {
          ...nodes[idx],
          ...(mod.label !== undefined ? { label: mod.label } : {}),
          ...(mod.type ? { shape: mod.type as NodeShape } : {}),
        };
      }
    }
  }

  // 4. addNodes — idempotent (skip if id already exists)
  if (patch.addNodes && patch.addNodes.length > 0) {
    const existingIds = new Set(nodes.map((n) => n.id));
    for (const n of patch.addNodes) {
      if (!existingIds.has(n.id)) {
        nodes.push({
          id: n.id,
          label: n.label,
          ...(n.type ? { shape: n.type as NodeShape } : {}),
        });
        existingIds.add(n.id);
      }
    }
  }

  // 5. addEdges — idempotent by from+to (always checked) OR by edge id
  if (patch.addEdges && patch.addEdges.length > 0) {
    const existingEdgeIds = new Set(edges.map((e) => e.id).filter(Boolean) as string[]);
    for (const e of patch.addEdges) {
      const edgeId = e.id;
      // Skip if edge id already exists in graph
      if (edgeId && existingEdgeIds.has(edgeId)) continue;
      // Skip if same from+to already exists (always checked — prevents semantic duplicates)
      if (edges.some((ex) => ex.from === e.from && ex.to === e.to)) continue;
      const newEdge: (typeof edges)[number] = { from: e.from, to: e.to };
      if (e.label) newEdge.label = e.label;
      if (edgeId) newEdge.id = edgeId;
      edges.push(newEdge);
      if (edgeId) existingEdgeIds.add(edgeId);
    }
  }

  return { ...graph, nodes, edges };
}
