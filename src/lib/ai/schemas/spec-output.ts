import { z } from 'zod';

export const UserStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()).default([]),
  priority: z.enum(['must', 'should', 'could', 'wont']).default('should'),
});

export const EdgeCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  mitigation: z.string().optional().default(''),
});

export const SpecOutputSchema = z.object({
  title: z.string().default(''),
  overview: z.string().default(''),
  stories: z.array(UserStorySchema).default([]),
  edgeCases: z.array(EdgeCaseSchema).default([]),
  technicalNotes: z.string().optional().default(''),
});

export type UserStory = z.infer<typeof UserStorySchema>;
export type EdgeCase = z.infer<typeof EdgeCaseSchema>;
export type SpecOutput = z.infer<typeof SpecOutputSchema>;
