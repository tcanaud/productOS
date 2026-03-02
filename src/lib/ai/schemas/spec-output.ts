import { z } from 'zod';

// ── Functional requirement ────────────────────────────────────────────────────

export const FunctionalRequirementSchema = z.object({
  id: z.string(),
  description: z.string(),
  sourceNodes: z.array(z.string()).default([]),
});

// ── Non-functional requirement ────────────────────────────────────────────────

export const NFRSchema = z.object({
  id: z.string(),
  description: z.string(),
});

// ── PRD ───────────────────────────────────────────────────────────────────────

export const PRDSchema = z.object({
  overview: z.string().default(''),
  goals: z.array(z.string()).default([]),
  requirements: z.array(FunctionalRequirementSchema).default([]),
  nfrs: z.array(NFRSchema).default([]),
});

// ── Acceptance criterion (GWT) ────────────────────────────────────────────────

export const AcceptanceCriterionSchema = z.object({
  given: z.string(),
  when: z.string(),
  then: z.string(),
  sourceNodes: z.array(z.string()).default([]),
});

// ── User story ────────────────────────────────────────────────────────────────

export const UserStorySchema = z.object({
  id: z.string(),
  role: z.string(),
  action: z.string(),
  benefit: z.string(),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).default([]),
});

// ── Edge case ─────────────────────────────────────────────────────────────────

export const SpecEdgeCaseSchema = z.object({
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  sourceNodes: z.array(z.string()).default([]),
});

// ── Full generated spec ───────────────────────────────────────────────────────

export const GeneratedSpecSchema = z.object({
  prd: PRDSchema.default({}),
  stories: z.array(UserStorySchema).default([]),
  edgeCases: z.array(SpecEdgeCaseSchema).default([]),
});

export type FunctionalRequirement = z.infer<typeof FunctionalRequirementSchema>;
export type NFR = z.infer<typeof NFRSchema>;
export type PRD = z.infer<typeof PRDSchema>;
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
export type UserStory = z.infer<typeof UserStorySchema>;
export type SpecEdgeCase = z.infer<typeof SpecEdgeCaseSchema>;
export type GeneratedSpec = z.infer<typeof GeneratedSpecSchema>;

// Legacy alias kept for backward compatibility
export type SpecOutput = GeneratedSpec;
export const SpecOutputSchema = GeneratedSpecSchema;
