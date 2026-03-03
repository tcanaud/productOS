/**
 * BMAD Party Mode prompt builder.
 *
 * Produces a prompt instructing the LLM to respond as multiple expert personas
 * sequentially, separated by `---PERSONA:<id>---` delimiters.
 *
 * Cross-referencing rule: each persona after the first SHOULD reference a prior
 * persona by display name at least once.
 */
import type { PersonaDefinition } from '@/lib/personas/registry';

export interface PromptPair {
  system: string;
  user: string;
}

/**
 * Build the system + user prompt pair for BMAD Party Mode responses.
 *
 * @param personas - Ordered list of personas to respond (2–3).
 * @param messages - Full conversation history.
 * @param workspaceContext - Optional workspace context (workspace name / description).
 */
export function buildPartyModePrompt(
  personas: PersonaDefinition[],
  messages: { role: 'user' | 'assistant'; content: string }[],
  workspaceContext?: string
): PromptPair {
  const personaDescriptions = personas
    .map(
      (p, idx) =>
        `### Persona ${idx + 1}: ${p.displayName} (id: ${p.id})\n${p.systemPromptFragment}`
    )
    .join('\n\n');

  const crossReferenceInstruction =
    personas.length > 1
      ? `
CROSS-REFERENCING RULE:
- Each persona after the first SHOULD naturally reference a previous persona by their display name at least once.
- Examples: "Building on what ${personas[0].displayName} said...", "I agree with ${personas[0].displayName} that..."
- Keep cross-references natural and conversational, not forced.`
      : '';

  const delimiterFormat = personas
    .map((p) => `---PERSONA:${p.id}---\n[${p.displayName}'s response here]`)
    .join('\n\n');

  const system = `You are a panel of expert AI advisors helping a Product Manager design a product flow.
You will respond AS EACH of the following personas SEQUENTIALLY.

${personaDescriptions}

RESPONSE FORMAT (CRITICAL):
You MUST produce each persona's response separated by the delimiter ---PERSONA:<id>--- on its own line.
Use EXACTLY these delimiters in this order:
${personas.map((p) => `---PERSONA:${p.id}---`).join('\n')}

Each persona section should be 2–4 sentences in that persona's distinct voice.
${crossReferenceInstruction}

EXAMPLE STRUCTURE:
${delimiterFormat}

RULES:
- Start DIRECTLY with the first delimiter (no preamble text before it)
- Each section must be self-contained and meaningful on its own
- Stay strictly in character for each persona
- Do NOT add extra delimiters or change the format`;

  const historyText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const contextSection = workspaceContext ? `\nWorkspace context: ${workspaceContext}\n` : '';

  const user = `${contextSection}
Conversation history:
${historyText || 'No conversation yet.'}

Respond now as each of the ${personas.length} personas above, following the required delimiter format.`;

  return { system, user };
}
