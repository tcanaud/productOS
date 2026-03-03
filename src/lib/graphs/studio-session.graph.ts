/**
 * Studio Session Graph — claudegraph
 *
 * Orchestrates the full design conversation between a PM and AI personas.
 * Uses AskHumanNode (= InteractionNode) to pause and emit questions to the frontend.
 *
 * Flow:
 *   [parse-input] → [select-personas] → [multi-persona-respond (LLMNode)]
 *     → [present-to-user (AskHumanNode)] → [route]
 *     → loop OR [enough-context?]
 *          ↓ yes
 *        [generate (LLMNode)] → [present-diagram-to-user (AskHumanNode)]
 *          → [route-diagram]
 *              → [refine (LLMNode)] → [present-diagram-to-user]   (loop)
 *              → [persist]                                         → END
 */
import { Graph, FnNode, LLMNode, AskHumanNode } from 'claudegraph';
import { z } from 'zod';
import type { StudioSessionState, DiagramPatch } from './studio-session.types';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import { json2mermaid } from '@/lib/json2mermaid';
import { ALL_PERSONA_IDS, PERSONAS } from '@/lib/ai/prompts/personas';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Classify user intent from raw message text. */
export function classifyIntent(message: string): 'describe' | 'refine' | 'confirm' | 'other' {
  const lower = message.toLowerCase().trim();

  if (
    lower === 'yes' ||
    lower === 'ok' ||
    lower === 'looks good' ||
    lower === 'confirm' ||
    lower === 'approve' ||
    lower.startsWith('yes,') ||
    lower.startsWith("that's good") ||
    lower.startsWith('that looks good')
  ) {
    return 'confirm';
  }

  const refineKeywords = [
    'add',
    'remove',
    'delete',
    'change',
    'rename',
    'move',
    'update',
    'modify',
    'adjust',
    'fix',
    'edit',
    'replace',
    'swap',
    'connect',
    'disconnect',
    'refine',
    'improve',
    'make',
    'put',
    'insert',
  ];
  if (refineKeywords.some((kw) => lower.includes(kw))) {
    return 'refine';
  }

  if (lower.length > 20) {
    return 'describe';
  }

  return 'other';
}

/** Estimate context richness from conversation messages (0–100). */
export function computeContextScore(messages: StudioSessionState['messages']): number {
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length === 0) return 0;

  let score = 0;

  // Number of user turns (max 30 pts, 10 pts each)
  score += Math.min(userMessages.length * 10, 30);

  // Total user text length (max 40 pts, 1 pt per 20 chars)
  const totalLength = userMessages.reduce((s, m) => s + m.content.length, 0);
  score += Math.min(Math.floor(totalLength / 20), 40);

  // Bonus if any message is a substantive description (≥30 chars — max 30 pts)
  const hasDescription = userMessages.some((m) => m.content.length >= 30);
  if (hasDescription) score += 30;

  return Math.min(score, 100);
}

/** Apply a DiagramPatch to an existing JsonGraph, returning a new JsonGraph. */
export function applyDiagramPatch(base: JsonGraph, patch: DiagramPatch): JsonGraph {
  let nodes = [...base.nodes];
  let edges = [...base.edges];

  if (patch.addNodes) {
    for (const n of patch.addNodes) {
      if (!nodes.find((x) => x.id === n.id)) {
        nodes.push({ id: n.id, label: n.label });
      }
    }
  }

  if (patch.removeNodes) {
    const removeSet = new Set(patch.removeNodes);
    nodes = nodes.filter((n) => !removeSet.has(n.id));
    edges = edges.filter((e) => !removeSet.has(e.from) && !removeSet.has(e.to));
  }

  if (patch.modifyNodes) {
    for (const mod of patch.modifyNodes) {
      const idx = nodes.findIndex((n) => n.id === mod.id);
      if (idx !== -1) {
        nodes[idx] = { ...nodes[idx], ...(mod.label ? { label: mod.label } : {}) };
      }
    }
  }

  if (patch.addEdges) {
    for (const e of patch.addEdges) {
      const exists = edges.find((x) => x.from === e.from && x.to === e.to);
      if (!exists) {
        edges.push({ from: e.from, to: e.to, ...(e.label ? { label: e.label } : {}) });
      }
    }
  }

  if (patch.removeEdges) {
    for (const re of patch.removeEdges) {
      edges = edges.filter((e) => !(e.from === re.from && e.to === re.to));
    }
  }

  return { ...base, nodes, edges };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas for LLMNode outputs
// ─────────────────────────────────────────────────────────────────────────────

const PersonaRespondSchema = z.object({
  mergedResponse: z.string(),
  followUpQuestion: z.string(),
  personaResponses: z.record(z.string(), z.string()),
  contextScore: z.number().min(0).max(100),
});

const GenerateDiagramSchema = z.object({
  diagramType: z.enum(['flowchart', 'stateDiagram', 'sequenceDiagram']),
  direction: z.enum(['TD', 'TB', 'BT', 'LR', 'RL']).optional(),
  title: z.string().optional().default(''),
  nodes: z
    .array(z.object({ id: z.string(), label: z.string(), shape: z.string().optional() }))
    .default([]),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
        type: z.string().optional(),
      })
    )
    .default([]),
});

const DiagramPatchSchema = z.object({
  addNodes: z
    .array(z.object({ id: z.string(), label: z.string(), type: z.string().optional() }))
    .optional(),
  removeNodes: z.array(z.string()).optional(),
  addEdges: z
    .array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() }))
    .optional(),
  removeEdges: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
  modifyNodes: z
    .array(z.object({ id: z.string(), label: z.string().optional(), type: z.string().optional() }))
    .optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

function buildMultiPersonaPrompt(state: StudioSessionState): string {
  const lastUserMessage =
    [...state.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const historyText = state.messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const personaList = ALL_PERSONA_IDS.map((id) => PERSONAS[id])
    .map((p) => `- ${p.id} (${p.name}): ${p.expertise.join(', ')}`)
    .join('\n');

  return `You are a panel of AI product design advisors helping a PM design a product flow.
Current conversation:
${historyText || `User: ${lastUserMessage}`}

Available personas:
${personaList}

Analyze the conversation and respond as the collective panel.
You MUST respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "mergedResponse": "<2-3 paragraph collaborative response from the panel>",
  "followUpQuestion": "<one focused follow-up question to gather more context>",
  "personaResponses": {
    "PM_OPTIMIST": "<PM Optimist perspective>",
    "ARCHITECT_PRAGMATIST": "<Architect perspective>",
    "ANALYST": "<Analyst perspective>",
    "CRITIC": "<Critic perspective>"
  },
  "contextScore": <0-100, how well we understand the flow to generate a diagram>
}

contextScore guidelines:
- 0-30: just started, need more info
- 30-59: partial understanding, need clarification
- 60-79: enough to generate a basic diagram
- 80-100: very clear requirements`;
}

function buildGenerateDiagramPrompt(state: StudioSessionState): string {
  const userMessages = state.messages.filter((m) => m.role === 'user');
  const context = userMessages.map((m) => m.content).join('\n');

  return `Generate a Mermaid diagram based on this product flow description:

${context}

You MUST respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "diagramType": "flowchart" | "stateDiagram" | "sequenceDiagram",
  "direction": "TD" | "LR" | "TB" | "BT" | "RL",
  "title": "<diagram title>",
  "nodes": [{ "id": "...", "label": "...", "shape": "..." }],
  "edges": [{ "from": "...", "to": "...", "label": "..." }]
}

Choose the most appropriate diagram type for the described flow.
Use clear, concise node labels. Node IDs must be alphanumeric (no spaces).`;
}

function buildRefineDiagramPrompt(state: StudioSessionState): string {
  const lastUserMessage =
    [...state.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const currentDiagram = state.currentDiagram
    ? JSON.stringify(state.currentDiagram, null, 2)
    : 'No current diagram';

  return `The user wants to refine the current diagram.

Current diagram:
${currentDiagram}

User's refinement request: "${lastUserMessage}"

Produce a JSON patch to update the diagram.
You MUST respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "addNodes": [{ "id": "...", "label": "..." }],
  "removeNodes": ["nodeId1", "nodeId2"],
  "addEdges": [{ "from": "...", "to": "...", "label": "..." }],
  "removeEdges": [{ "from": "...", "to": "..." }],
  "modifyNodes": [{ "id": "...", "label": "..." }]
}

Only include the keys that need changes. Omit keys that don't need updating.
Node IDs must be alphanumeric (no spaces).`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph factory
// ─────────────────────────────────────────────────────────────────────────────

export function createStudioSessionGraph() {
  const graph = new Graph('parse-input');

  // ── Node 1: parse-input ──────────────────────────────────────────────────
  graph.addNode(
    new FnNode({
      id: 'parse-input',
      fn: (ctx) => {
        const state = ctx.state as StudioSessionState;
        const lastUserMessage =
          [...state.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

        const intent = classifyIntent(lastUserMessage);
        const contextScore = computeContextScore(state.messages);

        return {
          kind: 'continue' as const,
          statePatch: { intent, contextScore },
        };
      },
    })
  );

  // ── Node 2: select-personas ──────────────────────────────────────────────
  graph.addNode(
    new FnNode({
      id: 'select-personas',
      fn: (_ctx) => {
        // All 4 personas always participate in studio sessions
        return {
          kind: 'continue' as const,
          statePatch: {},
        };
      },
    })
  );

  // ── Node 3: multi-persona-respond (LLMNode) ──────────────────────────────
  graph.addNode(
    new LLMNode({
      id: 'multi-persona-respond',
      provider: 'claude',
      schema: PersonaRespondSchema,
      prompt: (ctx) => buildMultiPersonaPrompt(ctx.state as StudioSessionState),
      maxRepairs: 2,
      timeoutMs: 120_000,
    })
  );

  // ── Node 4: present-to-user (AskHumanNode = InteractionNode) ────────────
  graph.addNode(
    new AskHumanNode({
      id: 'present-to-user',
      key: (ctx) => {
        const state = ctx.state as StudioSessionState;
        return `studio-question-${state.messages.length}`;
      },
      request: (ctx) => {
        const state = ctx.state as StudioSessionState & {
          'multi-persona-respond'?: { mergedResponse?: string; followUpQuestion?: string };
        };
        const llmOutput = state['multi-persona-respond'];
        const content = llmOutput?.followUpQuestion
          ? `${llmOutput.mergedResponse ?? ''}\n\n${llmOutput.followUpQuestion}`
          : (llmOutput?.mergedResponse ?? 'What would you like to design?');

        return {
          key: `studio-question-${state.messages.length}`,
          kind: 'text' as const,
          prompt: content,
        };
      },
      onAnswer: (ctx, answer) => {
        const state = ctx.state as StudioSessionState & {
          'multi-persona-respond'?: {
            mergedResponse?: string;
            followUpQuestion?: string;
            contextScore?: number;
            personaResponses?: Record<string, string>;
          };
        };
        const llmOutput = state['multi-persona-respond'];

        const newMessages: StudioSessionState['messages'] = [
          ...state.messages,
          ...(llmOutput?.mergedResponse
            ? [{ role: 'assistant' as const, content: llmOutput.mergedResponse }]
            : []),
          { role: 'user' as const, content: String(answer) },
        ];

        return {
          next: 'route',
          statePatch: {
            messages: newMessages,
            mergedResponse: llmOutput?.mergedResponse,
            followUpQuestion: llmOutput?.followUpQuestion,
            personaResponses: llmOutput?.personaResponses ?? {},
            contextScore: llmOutput?.contextScore ?? state.contextScore,
          },
        };
      },
    })
  );

  // ── Node 5: route ────────────────────────────────────────────────────────
  graph.addNode(
    new FnNode({
      id: 'route',
      fn: (ctx) => {
        const state = ctx.state as StudioSessionState;
        // Re-classify intent with latest message
        const lastUserMessage =
          [...state.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
        const intent = classifyIntent(lastUserMessage);
        const contextScore = computeContextScore(state.messages);

        return {
          kind: 'continue' as const,
          statePatch: { intent, contextScore },
        };
      },
    })
  );

  // ── Node 6: enough-context? ──────────────────────────────────────────────
  graph.addNode(
    new FnNode({
      id: 'enough-context',
      fn: (ctx) => {
        const state = ctx.state as StudioSessionState;
        // Routes to 'generate' if contextScore >= 60, else loops back to parse-input
        return {
          kind: 'continue' as const,
          statePatch: {},
        };
      },
    })
  );

  // ── Node 7: generate (LLMNode) ───────────────────────────────────────────
  graph.addNode(
    new LLMNode({
      id: 'generate',
      provider: 'claude',
      schema: GenerateDiagramSchema,
      prompt: (ctx) => buildGenerateDiagramPrompt(ctx.state as StudioSessionState),
      maxRepairs: 2,
      timeoutMs: 120_000,
    })
  );

  // ── Node 8: convert-diagram ──────────────────────────────────────────────
  // Converts LLMNode output (state.generate) to JsonGraph and mermaid syntax
  graph.addNode(
    new FnNode({
      id: 'convert-diagram',
      fn: (ctx) => {
        const state = ctx.state as StudioSessionState & {
          generate?: {
            diagramType: string;
            direction?: string;
            title?: string;
            nodes: Array<{ id: string; label: string; shape?: string }>;
            edges: Array<{ from: string; to: string; label?: string; type?: string }>;
          };
        };

        const generated = state.generate;
        if (!generated) {
          return {
            kind: 'continue' as const,
            statePatch: { error: 'No diagram generated' },
          };
        }

        const jsonGraph: JsonGraph = {
          diagramType: generated.diagramType as JsonGraph['diagramType'],
          direction: generated.direction as JsonGraph['direction'],
          title: generated.title ?? '',
          nodes: generated.nodes.map((n) => ({
            id: n.id,
            label: n.label,
          })),
          edges: generated.edges.map((e) => ({
            from: e.from,
            to: e.to,
            ...(e.label ? { label: e.label } : {}),
          })),
        };

        return {
          kind: 'continue' as const,
          statePatch: { currentDiagram: jsonGraph },
        };
      },
    })
  );

  // ── Node 9: apply-patch ──────────────────────────────────────────────────
  // Applies refine patch to currentDiagram
  graph.addNode(
    new FnNode({
      id: 'apply-patch',
      fn: (ctx) => {
        const state = ctx.state as StudioSessionState & {
          refine?: DiagramPatch;
        };

        if (!state.currentDiagram || !state.refine) {
          return { kind: 'continue' as const, statePatch: {} };
        }

        const updatedDiagram = applyDiagramPatch(state.currentDiagram, state.refine);
        return {
          kind: 'continue' as const,
          statePatch: { currentDiagram: updatedDiagram, lastPatch: state.refine },
        };
      },
    })
  );

  // ── Node 10: present-diagram-to-user (AskHumanNode = InteractionNode) ───
  graph.addNode(
    new AskHumanNode({
      id: 'present-diagram-to-user',
      key: (ctx) => {
        const state = ctx.state as StudioSessionState;
        return `studio-diagram-${state.messages.length}`;
      },
      request: (ctx) => {
        const state = ctx.state as StudioSessionState;
        const mermaid = state.currentDiagram ? json2mermaid(state.currentDiagram) : '';
        const prompt = state.lastPatch
          ? `I've updated the diagram based on your feedback.\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\nDoes this look right? You can ask me to refine it further, or say "confirm" to save it.`
          : `Here's the diagram I've generated based on our conversation:\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\nDoes this look right? You can ask me to refine it, or say "confirm" to save it.`;

        return {
          key: `studio-diagram-${state.messages.length}`,
          kind: 'text' as const,
          prompt,
        };
      },
      onAnswer: (ctx, answer) => {
        const state = ctx.state as StudioSessionState;
        const newMessages: StudioSessionState['messages'] = [
          ...state.messages,
          { role: 'user' as const, content: String(answer) },
        ];
        return {
          next: 'route-diagram',
          statePatch: { messages: newMessages },
        };
      },
    })
  );

  // ── Node 11: route-diagram ───────────────────────────────────────────────
  graph.addNode(
    new FnNode({
      id: 'route-diagram',
      fn: (ctx) => {
        const state = ctx.state as StudioSessionState;
        const lastUserMessage =
          [...state.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
        const intent = classifyIntent(lastUserMessage);

        return {
          kind: 'continue' as const,
          statePatch: { intent },
        };
      },
    })
  );

  // ── Node 12: refine (LLMNode) ────────────────────────────────────────────
  graph.addNode(
    new LLMNode({
      id: 'refine',
      provider: 'claude',
      schema: DiagramPatchSchema,
      prompt: (ctx) => buildRefineDiagramPrompt(ctx.state as StudioSessionState),
      maxRepairs: 2,
      timeoutMs: 120_000,
    })
  );

  // ── Node 13: persist ─────────────────────────────────────────────────────
  graph.addNode(
    new FnNode({
      id: 'persist',
      fn: (ctx) => {
        const state = ctx.state as StudioSessionState;
        // Persistence is handled by the API route after the graph ends.
        // Here we just mark completion with the workspaceId for the caller to use.
        if (!state.currentDiagram) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'No diagram to persist' },
          };
        }
        return {
          kind: 'end' as const,
          statePatch: {},
        };
      },
    })
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Edges
  // ─────────────────────────────────────────────────────────────────────────

  // parse-input → select-personas
  graph.from('parse-input').to('select-personas').done();

  // select-personas → multi-persona-respond
  graph.from('select-personas').to('multi-persona-respond').done();

  // multi-persona-respond → present-to-user
  graph.from('multi-persona-respond').to('present-to-user').done();

  // present-to-user → route
  graph.from('present-to-user').to('route').done();

  // route → enough-context (when intent is describe/other or contextScore high enough)
  // route → parse-input (loop when intent is unclear and context insufficient)
  graph
    .from('route')
    .to('enough-context')
    .when((ctx) => {
      const state = ctx.state as StudioSessionState;
      // Go to enough-context if we have any diagram context or user explicitly describes
      return state.contextScore >= 30 || state.intent === 'describe';
    })
    .priority(1)
    .done();

  graph
    .from('route')
    .to('parse-input')
    .when((ctx) => {
      const state = ctx.state as StudioSessionState;
      return state.contextScore < 30 && state.intent !== 'describe';
    })
    .priority(0)
    .done();

  // enough-context → generate (when contextScore >= 60)
  graph
    .from('enough-context')
    .to('generate')
    .when((ctx) => (ctx.state as StudioSessionState).contextScore >= 60)
    .priority(1)
    .done();

  // enough-context → parse-input (loop — need more context)
  graph
    .from('enough-context')
    .to('parse-input')
    .when((ctx) => (ctx.state as StudioSessionState).contextScore < 60)
    .priority(0)
    .done();

  // generate → convert-diagram
  graph.from('generate').to('convert-diagram').done();

  // convert-diagram → present-diagram-to-user
  graph.from('convert-diagram').to('present-diagram-to-user').done();

  // present-diagram-to-user → route-diagram
  graph.from('present-diagram-to-user').to('route-diagram').done();

  // route-diagram → refine (when intent is refine)
  graph
    .from('route-diagram')
    .to('refine')
    .when((ctx) => (ctx.state as StudioSessionState).intent === 'refine')
    .priority(1)
    .done();

  // route-diagram → persist (when intent is confirm)
  graph
    .from('route-diagram')
    .to('persist')
    .when((ctx) => (ctx.state as StudioSessionState).intent === 'confirm')
    .priority(1)
    .done();

  // route-diagram → present-diagram-to-user (loop on other/unclear)
  graph
    .from('route-diagram')
    .to('present-diagram-to-user')
    .when((ctx) => {
      const intent = (ctx.state as StudioSessionState).intent;
      return intent !== 'refine' && intent !== 'confirm';
    })
    .priority(0)
    .done();

  // refine → apply-patch
  graph.from('refine').to('apply-patch').done();

  // apply-patch → present-diagram-to-user (show updated diagram)
  graph.from('apply-patch').to('present-diagram-to-user').done();

  return graph;
}
