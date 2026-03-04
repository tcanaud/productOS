/**
 * Refinement prompt builder for Story 6.5 — Iterative Diagram Refinement via Chat.
 * Extended in Story 10.1 to inject LayerContext when editing a child layer.
 *
 * Builds a prompt pair instructing the LLM to return ONLY a DiagramPatch JSON object
 * — never a full graph regeneration.
 */
import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { PromptPair } from '@/lib/ai/prompts/party-mode';
import type { LayerContext } from '@/lib/layer/context-builder';

export type { PromptPair };

/**
 * Build the ## Layer Context section injected into the system prompt.
 * Omits subsections that have no data.
 */
function buildLayerContextBlock(ctx: LayerContext): string {
  const lines: string[] = [];

  lines.push(`## Layer Context`);
  lines.push('');
  lines.push(`You are editing layer "${ctx.current.name}" (depth ${ctx.current.depth}).`);

  // Current layer ports
  const inputs = ctx.current.ports.filter((p) => p.direction === 'input');
  const outputs = ctx.current.ports.filter((p) => p.direction === 'output');
  if (inputs.length > 0 || outputs.length > 0) {
    lines.push('');
    lines.push('### Current Layer Interface (RESPECT THESE — do not remove port-connected nodes)');
    if (inputs.length > 0) {
      lines.push(
        `Inputs:  ${inputs.map((p) => `${p.name}${p.type ? ` (${p.type})` : ''}`).join(', ')}`
      );
    }
    if (outputs.length > 0) {
      lines.push(
        `Outputs: ${outputs.map((p) => `${p.name}${p.type ? ` (${p.type})` : ''}`).join(', ')}`
      );
    }
  }

  // Parent context
  if (ctx.parent) {
    lines.push('');
    lines.push(`### Parent Layer: "${ctx.parent.name}"`);
    const parentInputs = ctx.parent.ports.filter((p) => p.direction === 'input');
    const parentOutputs = ctx.parent.ports.filter((p) => p.direction === 'output');
    if (parentOutputs.length > 0) {
      lines.push(`Parent feeds into this layer: ${parentOutputs.map((p) => p.name).join(', ')}`);
    }
    if (parentInputs.length > 0) {
      lines.push(`This layer must produce: ${parentInputs.map((p) => p.name).join(', ')}`);
    }
    if (ctx.parent.siblings.length > 0) {
      const siblingList = ctx.parent.siblings
        .slice(0, 5)
        .map((s) => `${s.name}${s.summary ? ` — ${s.summary}` : ''}`)
        .join('; ');
      lines.push(`Sibling layers: ${siblingList}`);
    }
  }

  // Ancestors
  if (ctx.ancestors.length > 0) {
    lines.push('');
    lines.push('### Ancestor Layers');
    for (const a of ctx.ancestors) {
      lines.push(`- ${a.name} (depth ${a.depth}): ${a.summary}`);
    }
  }

  // Children
  if (ctx.children.length > 0) {
    lines.push('');
    lines.push('### Child Layers');
    for (const c of ctx.children) {
      const childInputs = c.ports.filter((p) => p.direction === 'input').map((p) => p.name);
      const childOutputs = c.ports.filter((p) => p.direction === 'output').map((p) => p.name);
      const portSummary = [
        childInputs.length > 0 ? `in: ${childInputs.join(', ')}` : '',
        childOutputs.length > 0 ? `out: ${childOutputs.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      lines.push(`- ${c.name}${portSummary ? ` (${portSummary})` : ''}`);
    }
  }

  lines.push('');
  lines.push(
    "**Contract Rule**: Your patch MUST NOT remove nodes that are directly connected to the port inputs/outputs listed above. Respect the layer's interface contract."
  );

  return lines.join('\n');
}

/**
 * Build the system + user prompt pair for diagram refinement.
 *
 * @param currentGraph - The current JsonGraph (source of truth).
 * @param instruction - The user's natural-language refinement instruction.
 * @param conversationHistory - Last N messages for context (typically last 6).
 * @param layerContext - Optional layer hierarchy context (Story 10.1).
 */
export function buildRefinePrompt(
  currentGraph: JsonGraph,
  instruction: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  layerContext?: LayerContext
): PromptPair {
  const baseSystem = `You are a diagram refinement assistant. Your ONLY task is to produce a JSON patch that modifies the current diagram.

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

  // Story 10.1 — inject layer context block when editing a child layer
  const layerContextBlock = layerContext ? buildLayerContextBlock(layerContext) : '';
  const system = layerContextBlock ? `${baseSystem}\n\n${layerContextBlock}` : baseSystem;

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
