import { z } from 'zod';

export const ChatResponseSchema = z.object({
  content: z.string(),
  persona: z.string().optional().default(''),
  suggestions: z.array(z.string()).optional().default([]),
  citations: z.array(z.string()).optional().default([]),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
