export interface LayerPort {
  id: string;
  label: string;
  direction: 'in' | 'out';
}

export interface LayerGraphRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  parentNodeId: string | null;
  parentGraphId: string | null;
  depth: number;
  ports: LayerPort[];
  graph: object;
  summary: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  children?: LayerGraphRecord[];
}

export interface SoftLimitWarnings {
  depthExceeded?: boolean;
  portsExceeded?: boolean;
  nodesExceeded?: boolean;
  compositesExceeded?: boolean;
}

export const SOFT_LIMITS = {
  depth: 6,
  ports: 10,
  nodes: 50,
  composites: 15,
} as const;
