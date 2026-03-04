export interface LayerPort {
  id: string;
  name: string;
  direction: 'input' | 'output';
  type?: string;
  order: number;
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

// Re-export for convenience — defined in contract-validator.ts
export type { ValidationWarning } from './contract-validator';
