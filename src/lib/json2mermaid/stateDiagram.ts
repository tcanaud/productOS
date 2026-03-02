import type { JsonGraph, GraphNode, GraphEdge } from './types';

const START_NODE_IDS = new Set(['[*]', '__start__', 'start', 'START']);
const END_NODE_IDS = new Set(['[*]_end', '__end__', 'end', 'END']);

function isStartNode(id: string): boolean {
  return START_NODE_IDS.has(id) || id.toLowerCase() === 'start';
}

function isEndNode(id: string): boolean {
  return END_NODE_IDS.has(id) || id.toLowerCase() === 'end';
}

function sanitizeId(id: string): string {
  if (isStartNode(id) || isEndNode(id)) return '[*]';
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeLabel(label: string): string {
  return label.replace(/"/g, "'");
}

function renderStateNode(node: GraphNode): string {
  const safeId = sanitizeId(node.id);
  if (safeId === '[*]') return ''; // start/end are implicit
  const label = sanitizeLabel(node.label);
  if (label && label !== node.id) {
    return `  ${safeId} : ${label}`;
  }
  return `  ${safeId}`;
}

function renderStateEdge(edge: GraphEdge): string {
  const from = sanitizeId(edge.from);
  const to = sanitizeId(edge.to);

  if (edge.label) {
    const label = sanitizeLabel(edge.label);
    return `  ${from} --> ${to} : ${label}`;
  }
  return `  ${from} --> ${to}`;
}

export function stateDiagramToMermaid(graph: JsonGraph): string {
  const lines: string[] = ['stateDiagram-v2'];

  for (const node of graph.nodes) {
    const line = renderStateNode(node);
    if (line) lines.push(line);
  }

  for (const edge of graph.edges) {
    lines.push(renderStateEdge(edge));
  }

  return lines.join('\n');
}
