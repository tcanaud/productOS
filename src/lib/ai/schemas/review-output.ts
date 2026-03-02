import { z } from 'zod';

// ── Legacy schema (kept for backward compat with other stories) ──────────────

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

// ── Story 3.1: Multi-profile review schema ───────────────────────────────────

export const ReviewProfile = z.enum(['optimist', 'moderate', 'critic']);
export type ReviewProfile = z.infer<typeof ReviewProfile>;

export const EdgeCaseSchema = z.object({
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  affectedNodes: z.array(z.string()).default([]),
});

export const RiskSchema = z.object({
  description: z.string(),
  likelihood: z.enum(['high', 'medium', 'low']).default('medium'),
  impact: z.enum(['high', 'medium', 'low']).default('medium'),
  affectedNodes: z.array(z.string()).default([]),
});

export const InconsistencySchema = z.object({
  description: z.string(),
  affectedNodes: z.array(z.string()).default([]),
});

export const SuggestionSchema = z.object({
  description: z.string(),
  actionable: z.boolean().default(true),
  targetNode: z.string().default(''),
});

export const MultiProfileReviewSchema = z.object({
  profile: ReviewProfile,
  summary: z.string().default(''),
  edgeCases: z.array(EdgeCaseSchema).default([]),
  risks: z.array(RiskSchema).default([]),
  inconsistencies: z.array(InconsistencySchema).default([]),
  suggestions: z.array(SuggestionSchema).default([]),
});

export type EdgeCase = z.infer<typeof EdgeCaseSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type Inconsistency = z.infer<typeof InconsistencySchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type MultiProfileReview = z.infer<typeof MultiProfileReviewSchema>;
