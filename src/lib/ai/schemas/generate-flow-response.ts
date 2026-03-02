import { z } from 'zod';

export const GenerateFlowNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  shape: z.string().optional(),
});

export const GenerateFlowEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
});

export const GenerateFlowResponseSchema = z.object({
  diagramType: z.enum(['flowchart', 'stateDiagram', 'sequenceDiagram']),
  direction: z.enum(['TD', 'TB', 'BT', 'LR', 'RL']).optional(),
  title: z.string().optional().default(''),
  nodes: z.array(GenerateFlowNodeSchema).default([]),
  edges: z.array(GenerateFlowEdgeSchema).default([]),
  explanation: z.string().default(''),
});

export type GenerateFlowResponse = z.infer<typeof GenerateFlowResponseSchema>;
