import { z } from 'zod';

export const ReviewFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  category: z.string().default('general'),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().optional().default(''),
  nodeId: z.string().optional(),
});

export const ReviewOutputSchema = z.object({
  score: z.number().min(0).max(100).default(0),
  summary: z.string().default(''),
  findings: z.array(ReviewFindingSchema).default([]),
  strengths: z.array(z.string()).default([]),
  persona: z.string().optional().default(''),
});

export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
