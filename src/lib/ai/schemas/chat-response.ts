import { z } from 'zod';

// ── Suggestion ────────────────────────────────────────────────────────────────

export const SuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['edge-case', 'requirement', 'diagram-edit', 'note']),
  payload: z.string(),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

// ── Persona response ──────────────────────────────────────────────────────────

export const PersonaResponseSchema = z.object({
  personaId: z.string().min(1),
  name: z.string(),
  message: z.string(),
  suggestions: z.array(SuggestionSchema).default([]),
});

export type PersonaResponse = z.infer<typeof PersonaResponseSchema>;

// ── Full chat response (multi-persona) ────────────────────────────────────────

export const ChatResponseSchema = z.object({
  responses: z.array(PersonaResponseSchema),
  turn: z.number().int().nonnegative().default(0),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ── Chat message (conversation history) ──────────────────────────────────────

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  personaId: z.string().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
