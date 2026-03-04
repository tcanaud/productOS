import type { LayerPort } from './types';
import type { JsonGraph } from '@/lib/json2mermaid/types';

export interface PortContractWarning {
  portId?: string;
  edgeId?: string;
  message: string;
}

/**
 * Validate port↔edge contract consistency.
 * Checks that any edge referencing a port ID in its `from` or `to` field
 * still has a matching port in the ports array.
 */
export function validatePortContract(ports: LayerPort[], graph: JsonGraph): PortContractWarning[] {
  const portIds = new Set(ports.map((p) => p.id));
  const warnings: PortContractWarning[] = [];

  for (const edge of graph.edges) {
    const fromIsPort = edge.from.startsWith('port:');
    const toIsPort = edge.to.startsWith('port:');

    if (fromIsPort) {
      const portId = edge.from.slice(5);
      if (!portIds.has(portId)) {
        warnings.push({
          portId,
          edgeId: edge.id,
          message: `Edge "${edge.id ?? `${edge.from}→${edge.to}`}" references removed port "${portId}"`,
        });
      }
    }

    if (toIsPort) {
      const portId = edge.to.slice(5);
      if (!portIds.has(portId)) {
        warnings.push({
          portId,
          edgeId: edge.id,
          message: `Edge "${edge.id ?? `${edge.from}→${edge.to}`}" references removed port "${portId}"`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Count how many edges in the graph reference a given portId.
 */
export function countEdgeReferences(portId: string, graph: JsonGraph): number {
  const portRef = `port:${portId}`;
  return graph.edges.filter((e) => e.from === portRef || e.to === portRef).length;
}
