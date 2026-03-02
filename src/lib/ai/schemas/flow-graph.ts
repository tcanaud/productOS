import { z } from 'zod';

export const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().default('default'),
  label: z.string(),
  description: z.string().optional().default(''),
  position: z.object({ x: z.number(), y: z.number() }).optional().default({ x: 0, y: 0 }),
});

export const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional().default(''),
  type: z.string().optional().default('default'),
});

export const FlowGraphSchema = z.object({
  nodes: z.array(FlowNodeSchema).default([]),
  edges: z.array(FlowEdgeSchema).default([]),
  title: z.string().optional().default(''),
  description: z.string().optional().default(''),
});

export type FlowNode = z.infer<typeof FlowNodeSchema>;
export type FlowEdge = z.infer<typeof FlowEdgeSchema>;
export type FlowGraph = z.infer<typeof FlowGraphSchema>;
