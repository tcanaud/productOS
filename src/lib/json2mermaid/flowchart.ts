import type { JsonGraph, GraphNode, GraphEdge, FlowchartDirection } from './types';

const SHAPE_OPEN: Record<string, string> = {
  round: '(',
  rect: '[',
  stadium: '([',
  subroutine: '[[',
  cylinder: '[(', // Mermaid uses [(text)]
  circle: '((',
  asymmetric: '>',
  rhombus: '{',
  hexagon: '{{',
  parallelogram: '[/',
  'parallelogram-alt': '[\\',
  trapezoid: '[/',
  'trapezoid-alt': '[\\',
};

const SHAPE_CLOSE: Record<string, string> = {
  round: ')',
  rect: ']',
  stadium: '])',
  subroutine: ']]',
  cylinder: ')]',
  circle: '))',
  asymmetric: ']',
  rhombus: '}',
  hexagon: '}}',
  parallelogram: '/]',
  'parallelogram-alt': '\\]',
  trapezoid: '\\]',
  'trapezoid-alt': '/]',
};

function sanitizeLabel(label: string): string {
  return label.replace(/"/g, "'");
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function renderNode(node: GraphNode): string {
  const safeId = sanitizeId(node.id);
  const shape = node.shape ?? 'rect';
  const open = SHAPE_OPEN[shape] ?? '[';
  const close = SHAPE_CLOSE[shape] ?? ']';
  const label = sanitizeLabel(node.label);
  return `  ${safeId}${open}"${label}"${close}`;
}

function renderEdge(edge: GraphEdge): string {
  const from = sanitizeId(edge.from);
  const to = sanitizeId(edge.to);
  const type = edge.type ?? 'arrow';

  let arrow: string;
  switch (type) {
    case 'open':
      arrow = '---';
      break;
    case 'dotted':
      arrow = edge.label ? '-. "{{label}}" .->' : '-.->';
      break;
    case 'thick':
      arrow = edge.label ? '== "{{label}}" ==>' : '==>';
      break;
    default:
      arrow = '-->';
  }

  if (type === 'dotted' || type === 'thick') {
    if (edge.label) {
      const label = sanitizeLabel(edge.label);
      arrow = arrow.replace('{{label}}', label);
    }
    return `  ${from} ${arrow} ${to}`;
  }

  if (edge.label) {
    const label = sanitizeLabel(edge.label);
    return `  ${from} ${arrow}|"${label}"| ${to}`;
  }

  return `  ${from} ${arrow} ${to}`;
}

export function flowchartToMermaid(graph: JsonGraph): string {
  const direction: FlowchartDirection = graph.direction ?? 'TD';
  const lines: string[] = [`flowchart ${direction}`];

  for (const node of graph.nodes) {
    lines.push(renderNode(node));
  }

  for (const edge of graph.edges) {
    lines.push(renderEdge(edge));
  }

  return lines.join('\n');
}
