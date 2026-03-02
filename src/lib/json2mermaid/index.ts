import { flowchartToMermaid } from './flowchart';
import { stateDiagramToMermaid } from './stateDiagram';
import { sequenceDiagramToMermaid } from './sequenceDiagram';
import { validateMermaidSyntax } from './validate';
import type { JsonGraph } from './types';

export type { JsonGraph, GraphNode, GraphEdge, GraphMeta, DiagramType } from './types';
export { validateMermaidSyntax } from './validate';

/**
 * Convert a JsonGraph to Mermaid syntax.
 *
 * @param graph - The JSON graph to convert.
 * @returns Valid Mermaid syntax string.
 * @throws Error if the diagram type is unsupported or output validation fails.
 */
export function json2mermaid(graph: JsonGraph): string {
  let syntax: string;

  switch (graph.diagramType) {
    case 'flowchart':
      syntax = flowchartToMermaid(graph);
      break;
    case 'stateDiagram':
      syntax = stateDiagramToMermaid(graph);
      break;
    case 'sequenceDiagram':
      syntax = sequenceDiagramToMermaid(graph);
      break;
    default: {
      const _exhaustive: never = graph.diagramType;
      throw new Error(`Unsupported diagram type: ${String(_exhaustive)}`);
    }
  }

  const validation = validateMermaidSyntax(syntax);
  if (!validation.valid) {
    throw new Error(`Generated invalid Mermaid syntax: ${validation.error}`);
  }

  return syntax;
}
