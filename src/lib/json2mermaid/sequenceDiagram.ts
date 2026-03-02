import type { JsonGraph, GraphNode, GraphEdge } from './types';

function sanitizeParticipant(id: string): string {
  return id.replace(/[^a-zA-Z0-9_ ]/g, '_');
}

function sanitizeLabel(label: string): string {
  return label.replace(/:/g, '&#58;');
}

function renderParticipant(node: GraphNode): string {
  const safeId = sanitizeParticipant(node.id);
  const label = node.label.trim();
  if (label && label !== node.id) {
    return `  participant ${safeId} as ${label}`;
  }
  return `  participant ${safeId}`;
}

function renderMessage(edge: GraphEdge): string {
  const from = sanitizeParticipant(edge.from);
  const to = sanitizeParticipant(edge.to);
  const type = edge.type ?? 'arrow';
  const label = edge.label ? sanitizeLabel(edge.label) : 'message';

  let arrow: string;
  switch (type) {
    case 'dotted':
      arrow = '-->';
      break;
    case 'open':
      arrow = '-x';
      break;
    case 'thick':
      arrow = '->>';
      break;
    default:
      arrow = '->>';
  }

  return `  ${from}${arrow}${to}: ${label}`;
}

export function sequenceDiagramToMermaid(graph: JsonGraph): string {
  const lines: string[] = ['sequenceDiagram'];

  for (const node of graph.nodes) {
    lines.push(renderParticipant(node));
  }

  for (const edge of graph.edges) {
    lines.push(renderMessage(edge));
  }

  return lines.join('\n');
}
