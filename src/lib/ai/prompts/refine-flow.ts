/**
 * Refinement prompt builder for Story 6.5 — Iterative Diagram Refinement via Chat.
 *
 * Builds a prompt pair instructing the LLM to return ONLY a DiagramPatch JSON object
 * — never a full graph regeneration.
 */
import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { PromptPair } from '@/lib/ai/prompts/party-mode';

export type { PromptPair };

/**
 * Build the system + user prompt pair for diagram refinement.
 *
 * @param currentGraph - The current JsonGraph (source of truth).
 * @param instruction - The user's natural-language refinement instruction.
 * @param conversationHistory - Last N messages for context (typically last 6).
 */
export function buildRefinePrompt(
  currentGraph: JsonGraph,
  instruction: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): PromptPair {
  const system = `You are a diagram refinement assistant. Your ONLY task is to produce a JSON patch that modifies the current diagram.

You MUST return ONLY a DiagramPatch JSON object. Do NOT return the full graph. If no change is needed, return an empty object \`{}\`.

## DiagramPatch format

\`\`\`json
{
  "addNodes":    [{ "id": "...", "label": "...", "type": "..." }],
  "removeNodes": ["nodeId1", "nodeId2"],
  "addEdges":    [{ "id": "...", "from": "...", "to": "...", "label": "..." }],
  "removeEdges": ["edgeId1", "edgeId2"],
  "modifyNodes": [{ "id": "...", "label": "...", "type": "..." }],
  "summary":     "Brief explanation of WHAT was changed and WHY (1-2 sentences, user-facing)"
}
\`\`\`

Rules:
- Only include keys that need changes. Omit keys that don't need updating.
- Node IDs must be alphanumeric (no spaces, no special chars).
- addNodes and addEdges are idempotent: if an id already exists, it will be skipped.
- removeNodes cascades: all edges referencing a removed node id are also removed.
- modifyNodes performs a shallow merge: only the provided fields are updated.
- Patch application order: removeNodes → removeEdges → modifyNodes → addNodes → addEdges
- Available node "type" values: "rect" (action/process), "round" (soft action/note), "rhombus" (decision/condition), "stadium" (start/end/milestone), "circle" (connector), "cylinder" (database/storage), "subroutine" (sub-process/external call), "hexagon" (preparation/setup), "parallelogram" (input/output), "trapezoid" (manual operation)
- Always set the appropriate "type" on addNodes and modifyNodes to match the node's semantic role

## Few-shot examples

Instruction: "Add an error flow after payment"
Patch:
\`\`\`json
{
  "addNodes": [{ "id": "err1", "label": "Payment Failed?", "type": "rhombus" }],
  "addEdges": [{ "id": "e-pay-err1", "from": "payment", "to": "err1", "label": "failure" }],
  "summary": "Added a 'Payment Failed?' decision node after payment to handle error cases."
}
\`\`\`

Instruction: "Remove the notification step"
Patch:
\`\`\`json
{
  "removeNodes": ["notify"],
  "summary": "Removed the notification step and its connections from the flow."
}
\`\`\`

Instruction: "Rename 'Checkout' to 'Payment Processing'"
Patch:
\`\`\`json
{
  "modifyNodes": [{ "id": "checkout", "label": "Payment Processing" }],
  "summary": "Renamed 'Checkout' to 'Payment Processing' for clarity."
}
\`\`\`

Instruction: "Connect Cart directly to Confirmation"
Patch:
\`\`\`json
{
  "addEdges": [{ "id": "e-cart-confirm", "from": "cart", "to": "confirm" }],
  "summary": "Added a direct connection from Cart to Confirmation, creating a shortcut path."
}
\`\`\`

CRITICAL: Do NOT return the full graph. ONLY return the patch JSON object.`;

  const historyText =
    conversationHistory.length > 0
      ? conversationHistory
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n')
      : 'No prior conversation.';

  const user = `## Current diagram (JSON)

\`\`\`json
${JSON.stringify(currentGraph, null, 2)}
\`\`\`

## Recent conversation context

${historyText}

## Refinement instruction

"${instruction}"

Produce the DiagramPatch JSON for this instruction. Remember: return ONLY the patch object, not the full graph.`;

  return { system, user };
}
