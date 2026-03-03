/**
 * patchGraph — shared utility for node-level graph mutations.
 *
 * Removes a target node (and all its incident edges) from a base JsonGraph,
 * re-wires the external boundary connections to the fragment's first/last nodes,
 * then merges the fragment nodes and edges into the result.
 *
 * Used by expand-node and simplify-node graphs.
 */
import type { JsonGraph, GraphNode, GraphEdge } from '@/lib/json2mermaid/types';

/**
 * Replace `removedNodeId` in `base` with the nodes/edges from `fragment`.
 *
 * Convention:
 * - `fragment.nodes[0]` receives all incoming edges of `removedNodeId`
 * - `fragment.nodes[fragment.nodes.length - 1]` receives all outgoing edges of `removedNodeId`
 *
 * If the fragment is empty, the node is simply removed (no re-wiring).
 */
export function patchGraph(base: JsonGraph, fragment: JsonGraph, removedNodeId: string): JsonGraph {
  // Separate incident edges from unrelated edges
  const incomingEdges = base.edges.filter((e) => e.to === removedNodeId);
  const outgoingEdges = base.edges.filter((e) => e.from === removedNodeId);
  const unrelatedEdges = base.edges.filter(
    (e) => e.from !== removedNodeId && e.to !== removedNodeId
  );

  // Remove the target node from base nodes
  const remainingNodes: GraphNode[] = base.nodes.filter((n) => n.id !== removedNodeId);

  const firstFragmentNode = fragment.nodes[0];
  const lastFragmentNode = fragment.nodes[fragment.nodes.length - 1];

  // Re-wire incoming edges to the first fragment node
  const rewiredIncoming: GraphEdge[] = firstFragmentNode
    ? incomingEdges.map((e) => ({ ...e, to: firstFragmentNode.id }))
    : [];

  // Re-wire outgoing edges from the last fragment node
  const rewiredOutgoing: GraphEdge[] = lastFragmentNode
    ? outgoingEdges.map((e) => ({ ...e, from: lastFragmentNode.id }))
    : [];

  return {
    ...base,
    nodes: [...remainingNodes, ...fragment.nodes],
    edges: [...unrelatedEdges, ...rewiredIncoming, ...rewiredOutgoing, ...fragment.edges],
  };
}
