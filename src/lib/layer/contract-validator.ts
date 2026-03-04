/**
 * contract-validator.ts — Story 10.3
 *
 * Pure function: validates port↔edge contract consistency between a LayerGraph
 * and its parent graph. No side effects, no DB calls.
 *
 * Checks performed:
 *   1. Every input port has ≥1 incoming edge in the parent graph (edge.to === nodeId)
 *   2. Every output port has ≥1 outgoing edge in the parent graph (edge.from === nodeId)
 *   3. No edge inside layer.graph references a non-existent port
 *   4. If a port has a `type` defined, edges referencing it carry a compatible label (best-effort warn)
 */

import type { LayerPort, LayerGraphRecord } from './types';
import type { JsonGraph } from '@/lib/json2mermaid/types';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ValidationWarning {
  nodeId: string;
  severity: 'error' | 'warning';
  message: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * The node ID in the parent graph that this layer is decomposing.
 * Derived from LayerGraphRecord.parentNodeId.
 */
function getParentNodeId(layer: Pick<LayerGraphRecord, 'parentNodeId'>): string | null {
  return layer.parentNodeId ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate port↔edge contract for a composite node's layer.
 *
 * @param layer        - The LayerGraph record (ports + graph)
 * @param parentGraph  - The graph that contains the composite node this layer decomposes
 * @returns            - Array of ValidationWarning objects; empty when fully consistent
 */
export function validateContracts(
  layer: Pick<LayerGraphRecord, 'parentNodeId' | 'ports' | 'graph'>,
  parentGraph: JsonGraph
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const nodeId = getParentNodeId(layer);

  // If the layer has no parentNodeId, we can't check parent graph connectivity
  if (!nodeId) return warnings;

  const ports = layer.ports as LayerPort[];
  const layerGraph = layer.graph as JsonGraph;

  // ── Check 1 & 2: port connectivity in parent graph ────────────────────────
  for (const port of ports) {
    if (port.direction === 'input') {
      // Input port: need at least one incoming edge to this node in parent graph
      const hasIncoming = parentGraph.edges.some((e) => e.to === nodeId);
      if (!hasIncoming) {
        warnings.push({
          nodeId,
          severity: 'warning',
          message: `Input port "${port.name}" has no incoming edge in the parent graph`,
        });
      }
    } else {
      // Output port: need at least one outgoing edge from this node in parent graph
      const hasOutgoing = parentGraph.edges.some((e) => e.from === nodeId);
      if (!hasOutgoing) {
        warnings.push({
          nodeId,
          severity: 'warning',
          message: `Output port "${port.name}" has no outgoing edge in the parent graph`,
        });
      }
    }
  }

  // ── Check 3: no dangling port references in layer.graph edges ─────────────
  if (layerGraph && Array.isArray((layerGraph as JsonGraph).edges)) {
    const portIds = new Set(ports.map((p) => p.id));
    for (const edge of (layerGraph as JsonGraph).edges) {
      if (edge.from.startsWith('port:')) {
        const portId = edge.from.slice(5);
        if (!portIds.has(portId)) {
          warnings.push({
            nodeId,
            severity: 'error',
            message: `Edge "${edge.id ?? `${edge.from}→${edge.to}`}" references non-existent port "${portId}"`,
          });
        }
      }
      if (edge.to.startsWith('port:')) {
        const portId = edge.to.slice(5);
        if (!portIds.has(portId)) {
          warnings.push({
            nodeId,
            severity: 'error',
            message: `Edge "${edge.id ?? `${edge.from}→${edge.to}`}" references non-existent port "${portId}"`,
          });
        }
      }
    }
  }

  // ── Check 4: best-effort type compatibility ────────────────────────────────
  // If a port has a `type`, check that edges referencing it have a matching label (best-effort)
  for (const port of ports) {
    if (!port.type) continue;
    const portRef = `port:${port.id}`;
    const referencingEdges =
      layerGraph && Array.isArray((layerGraph as JsonGraph).edges)
        ? (layerGraph as JsonGraph).edges.filter((e) => e.from === portRef || e.to === portRef)
        : [];

    for (const edge of referencingEdges) {
      if (edge.label && edge.label !== port.type) {
        warnings.push({
          nodeId,
          severity: 'warning',
          message: `Port "${port.name}" expects type "${port.type}" but connected edge has label "${edge.label}"`,
        });
      }
    }
  }

  return warnings;
}
