/**
 * Onboarding prompt builder for Studio Session Graph.
 *
 * Produces system + user prompt pair for the multi-persona-respond LLMNode
 * when in onboarding mode.
 *
 * Rules enforced in the system prompt:
 * 1. Never repeat a question already asked in messages
 * 2. Always open by acknowledging the PM's last message in 1 sentence
 * 3. Ask questions in priority order: actors → happy path → constraints
 * 4. When onboardingPhase === 'confirm', produce exactly 1 yes/no confirmation
 * 5. When onboardingPhase === 'generate', prepend "I see the flow forming"
 */

export type OnboardingPhase = 'clarify' | 'confirm' | 'generate';

export interface OnboardingPromptInput {
  messages: { role: 'user' | 'assistant'; content: string }[];
  wordCount: number;
  onboardingPhase: OnboardingPhase;
  clarificationCount: number;
}

export interface OnboardingPromptPair {
  system: string;
  user: string;
}

/**
 * Build the system + user prompt pair for onboarding-aware conversation.
 */
export function buildOnboardingPrompt(input: OnboardingPromptInput): OnboardingPromptPair {
  const { messages, wordCount, onboardingPhase, clarificationCount } = input;

  const historyText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  // Derive input complexity description
  const inputComplexity =
    wordCount < 50
      ? 'brief (< 50 words)'
      : wordCount <= 100
        ? 'moderate (50–100 words)'
        : 'detailed (> 100 words)';

  // Max clarification questions allowed based on word count
  const maxClarifications = wordCount < 50 ? 3 : wordCount <= 100 ? 2 : 1;

  // Build phase-specific instructions
  let phaseInstructions: string;
  if (onboardingPhase === 'generate') {
    phaseInstructions = `The conversation now has sufficient context to generate a diagram.
Start your response with EXACTLY "I see the flow forming" (this exact phrase, no variation).
Then briefly summarize what you understood about the flow.
Set contextScore to a value >= 60 to trigger diagram generation.`;
  } else if (onboardingPhase === 'confirm') {
    phaseInstructions = `You have gathered enough context. Ask EXACTLY 1 yes/no confirmation question.
Example: "I have enough to generate a diagram. Shall I proceed?"
Do NOT ask multiple questions. Keep the confirmation short and clear.
Set contextScore to a value between 50 and 65.`;
  } else {
    // clarify phase
    const questionsLeft = maxClarifications - clarificationCount;
    phaseInstructions = `You are in the CLARIFICATION phase.
The user's initial input was ${inputComplexity}.
You have asked ${clarificationCount} clarification question(s) so far. You may ask up to ${questionsLeft} more.
Ask targeted questions in this PRIORITY ORDER:
  1. Actors (who are the main users/systems involved?)
  2. Happy path (what is the main successful flow?)
  3. Key constraints (any important limits, errors, or edge cases?)
Never repeat a question that was already asked in the conversation history.
Always ask exactly 1 focused question per turn (never multiple questions at once).
Set contextScore proportionally: 0-30 for minimal context, 30-59 for partial context.`;
  }

  const system = `You are a collaborative panel of AI product design advisors helping a Product Manager design a product flow diagram.

Your goal is to gather enough information to generate an accurate, well-structured diagram.

CONVERSATION RULES (follow strictly):
1. ALWAYS open your response by acknowledging the PM's last message in exactly 1 sentence. Be specific and contextual, not generic.
2. Never repeat a question already present in the conversation history.
3. Keep your responses concise and focused — avoid long paragraphs.
4. Questions must be targeted: actors, happy path, or constraints only.

CURRENT PHASE INSTRUCTIONS:
${phaseInstructions}

OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "mergedResponse": "<1–2 sentence acknowledgement + phase-appropriate content>",
  "followUpQuestion": "<single focused question OR empty string if generating>",
  "personaResponses": {
    "PM_OPTIMIST": "<PM Optimist perspective in 1 sentence>",
    "ARCHITECT_PRAGMATIST": "<Architect perspective in 1 sentence>",
    "ANALYST": "<Analyst perspective in 1 sentence>",
    "CRITIC": "<Critic perspective in 1 sentence>"
  },
  "contextScore": <integer 0–100>
}

contextScore thresholds:
- 0–29: just started, critical info missing
- 30–59: partial understanding, clarification needed
- 60–100: sufficient context to generate diagram (triggers generation)`;

  const user = `Conversation history:
${historyText || `User: ${lastUserMessage}`}

Current state:
- Input word count: ${wordCount} words (${inputComplexity})
- Onboarding phase: ${onboardingPhase}
- Clarification questions asked so far: ${clarificationCount}
- Max allowed clarifications: ${maxClarifications}

Respond following the CURRENT PHASE INSTRUCTIONS above.`;

  return { system, user };
}

/**
 * Determine the onboarding phase based on current state.
 *
 * - 'clarify': need to ask more targeted questions
 * - 'confirm': ready to generate, need one confirmation
 * - 'generate': generate immediately (detailed input or context confirmed)
 */
export function determineOnboardingPhase(
  wordCount: number,
  contextScore: number,
  clarificationCount: number
): OnboardingPhase {
  // Detailed input: go straight to generate if context is sufficient
  if (wordCount > 100 && contextScore >= 40) {
    return 'generate';
  }

  // Any input: if contextScore is high enough, generate
  if (contextScore >= 65) {
    return 'generate';
  }

  // Any input with enough exchanges and partial context: ask for confirmation
  if (contextScore >= 40 && clarificationCount >= 2) {
    return 'confirm';
  }

  // Moderate/detailed input with some context: ask for confirmation
  if (wordCount >= 50 && contextScore >= 40 && clarificationCount >= 1) {
    return 'confirm';
  }

  // Default: ask clarification questions
  return 'clarify';
}
