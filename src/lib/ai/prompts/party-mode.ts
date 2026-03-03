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
CROSS-REFERENCING RULE (replyTo):
- The FIRST persona MUST use replyTo=none.
- Each persona AFTER the first MUST set replyTo=<id of a previous persona in this turn>.
- The response text MUST explicitly name and react to the persona referenced by replyTo.
- Examples: "Building on what ${personas[0].displayName} said...", "I agree with ${personas[0].displayName} that...", "Unlike ${personas[0].displayName}, I think..."
- Keep cross-references natural and conversational, not forced.`
      : '';

  const emotionInstruction = `
EMOTION (required for each persona):
Each persona delimiter MUST include an emotion= attribute. Valid emotions:
- excited: genuinely enthusiastic about an idea or possibility
- thoughtful: carefully considering implications or trade-offs
- concerned: worried about a risk, gap, or potential problem
- skeptical: questioning an assumption or approach
- neutral: balanced, factual analysis without strong feeling
- supportive: encouraging and validating the direction
- curious: wanting to explore or learn more about an aspect
Choose the emotion that BEST fits what this persona is expressing. Vary emotions across personas — avoid giving everyone the same emotion.`;

  const continuityInstruction =
    messages.length > 2
      ? `
CONTINUITY RULE (conversation has ${messages.length} messages):
- Personas MUST build on what was discussed in PREVIOUS turns — do not restart analysis from scratch.
- Reference specific points, decisions, or insights from earlier in the conversation.
- Deepen the analysis: go beyond surface-level observations into implementation details, edge cases, and trade-offs.
- NEVER repeat a point or question that was already raised in a previous turn.`
      : '';

  const system = `You are a panel of expert AI advisors helping a Product Manager design a product flow.
You will respond AS EACH of the following personas SEQUENTIALLY, then conclude with a roundtable summary.

${personaDescriptions}

RESPONSE FORMAT (CRITICAL):
You MUST produce each persona's response separated by the delimiter on its own line:
---PERSONA:<id> emotion=<emotion> replyTo=<id|none>---

Use EXACTLY these persona IDs in this order:
${personas.map((p) => p.id).join(', ')}
${emotionInstruction}
${crossReferenceInstruction}
${continuityInstruction}

Each persona section should be 2–4 sentences in that persona's distinct voice. Personas do NOT ask questions — they provide insights and analysis only.

After ALL persona responses, you MUST include a ---ROUNDTABLE--- section.
This section synthesizes the discussion into:
- 1 to 2 focused questions for the PM (the most important things to clarify next), each on its own line starting with "Q:"
- 2 to 3 suggested answers or assumptions the PM could confirm/deny, each on its own line starting with "S:"
  Suggestions should be concrete, specific guesses based on what the personas discussed.

ROUNDTABLE QUALITY RULES:
- Questions MUST explore edge cases, error paths, integration points, or non-obvious requirements — NOT just the happy path.
- Suggestions MUST be specific enough to push the user to elaborate (e.g. "The retry logic should use exponential backoff with a 3-attempt cap" NOT "Error handling should be considered").
- NEVER repeat a question or suggestion already raised in a previous turn's roundtable.

EXAMPLE STRUCTURE:
---PERSONA:${personas[0]?.id ?? 'john'} emotion=excited replyTo=none---
[${personas[0]?.displayName ?? 'Product Strategist'}'s response here — 2-4 sentences, no questions]

${personas.length > 1 ? `---PERSONA:${personas[1].id} emotion=thoughtful replyTo=${personas[0].id}---\n[${personas[1].displayName}'s response here — references ${personas[0].displayName} by name]` : ''}

${personas.length > 2 ? `---PERSONA:${personas[2].id} emotion=skeptical replyTo=${personas[1].id}---\n[${personas[2].displayName}'s response here — references ${personas[1].displayName} by name]` : ''}

---ROUNDTABLE---
Q: What happens when the payment gateway returns a timeout — should the system retry or show a failure immediately?
Q: Are there regulatory constraints (PCI, GDPR) that affect how user data flows between steps?
S: The retry logic likely needs exponential backoff with a 3-attempt cap before showing failure
S: Payment should support both card and mobile wallet based on the B2C context
S: The notification step could be async via email rather than blocking the main flow

RULES:
- Start DIRECTLY with the first delimiter (no preamble text before it)
- Each persona section must be self-contained and meaningful on its own
- Stay strictly in character for each persona
- Personas provide analysis only — they do NOT ask questions in their section
- The ---ROUNDTABLE--- section MUST appear after all persona sections
- Questions (Q:) should be thematic and synthesize what the whole panel needs to know
- Suggestions (S:) should be educated guesses or assumptions the PM can quickly confirm or reject
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
