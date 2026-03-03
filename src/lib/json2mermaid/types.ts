export type DiagramType = 'flowchart' | 'stateDiagram' | 'sequenceDiagram';

export type FlowchartDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export type NodeShape =
  | 'round' // (text)
  | 'rect' // [text]
  | 'stadium' // ([text])
  | 'subroutine' // [[text]]
  | 'cylinder' // [(text)]
  | 'circle' // ((text))
  | 'asymmetric' // >text]
  | 'rhombus' // {text}
  | 'hexagon' // {{text}}
  | 'parallelogram' // [/text/]
  | 'parallelogram-alt' // [\text\]
  | 'trapezoid' // [/text\]
  | 'trapezoid-alt'; // [\text/]

export type EdgeType = 'arrow' | 'open' | 'dotted' | 'thick';

export interface GraphNode {
  id: string;
  label: string;
  shape?: NodeShape;
}

export interface GraphEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  type?: EdgeType;
}

export interface GraphMeta {
  diagramType: DiagramType;
  title?: string;
  direction?: FlowchartDirection;
}

export interface JsonGraph extends GraphMeta {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
