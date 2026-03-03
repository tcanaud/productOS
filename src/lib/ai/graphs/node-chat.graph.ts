/**
 * Node Chat Graph — claudegraph
 *
 * Answers user questions about a specific node in the workflow diagram:
 *
 *   [build-node-chat-prompt] → [chat (LLMNode)] → [format-response] → END
 */
import { z } from 'zod';
import { Graph, FnNode, LLMNode, GraphRunner } from 'claudegraph';
import type { JsonGraph } from '@/lib/json2mermaid/types';

// ─── Zod schema for LLM output ─────────────────────────────────────────────────

const NodeChatResponseSchema = z.object({
  answer: z.string(),
  relatedNodes: z.array(z.string()).optional(),
});

// ─── Internal graph state ──────────────────────────────────────────────────────

interface NodeChatState {
  graph: JsonGraph;
  nodeId: string;
  nodeLabel: string;
  question: string;
  workspaceContext: string;
  history?: string;
  // Set by LLMNode (keyed as state.chat)
  chat?: z.infer<typeof NodeChatResponseSchema>;
  // Set by format-response
  answer?: string;
  relatedNodes?: string[];
  error?: string;
}

// ─── Graph factory ─────────────────────────────────────────────────────────────

export function createNodeChatGraph() {
  const graph = new Graph('build-node-chat-prompt');

  // Node 1: validate node and build prompt context
  graph.addNode(
    new FnNode({
      id: 'build-node-chat-prompt',
      fn: (ctx) => {
        const state = ctx.state as NodeChatState;
        const { graph: jsonGraph, nodeId } = state;

        const targetNode = jsonGraph.nodes.find((n) => n.id === nodeId);
        if (!targetNode) {
          return {
            kind: 'end' as const,
            statePatch: { error: `Node "${nodeId}" not found in graph` },
          };
        }

        const predecessorIds = jsonGraph.edges.filter((e) => e.to === nodeId).map((e) => e.from);
        const successorIds = jsonGraph.edges.filter((e) => e.from === nodeId).map((e) => e.to);

        const predecessorLabels =
          predecessorIds
            .map((id) => jsonGraph.nodes.find((n) => n.id === id)?.label ?? id)
            .join(', ') || 'none';

        const successorLabels =
          successorIds
            .map((id) => jsonGraph.nodes.find((n) => n.id === id)?.label ?? id)
            .join(', ') || 'none';

        return {
          kind: 'continue' as const,
          statePatch: {
            nodeLabel: targetNode.label,
            predecessors: predecessorLabels,
            successors: successorLabels,
          },
        };
      },
    })
  );

  // Node 2: LLMNode — ask Claude to answer the question
  graph.addNode(
    new LLMNode({
      id: 'chat',
      provider: 'claude',
      schema: NodeChatResponseSchema,
      prompt: (ctx) => {
        const state = ctx.state as NodeChatState & {
          predecessors?: string;
          successors?: string;
        };

        const lines = [
          'You are a helpful business process analyst answering questions about a specific step in a workflow diagram.',
          '',
          state.workspaceContext,
          '',
          `## Node Context`,
          `- **Node:** "${state.nodeLabel}" (id: ${state.nodeId})`,
          `- **Incoming steps:** ${state.predecessors}`,
          `- **Outgoing steps:** ${state.successors}`,
          '',
        ];

        if (state.history) {
          lines.push('## Conversation History', '', state.history, '');
        }

        lines.push(
          '## User Question',
          '',
          state.question,
          '',
          'Answer the question concisely and helpfully. If relevant, mention related nodes in the diagram.',
          '',
          'Return a JSON object with this exact shape:',
          '{ "answer": string, "relatedNodes"?: string[] }',
          '',
          '- "answer": your response text',
          '- "relatedNodes": optional array of node labels that are relevant to the answer',
          '- Return ONLY the JSON object, no markdown, no commentary',
        );

        return lines.join('\n');
      },
      maxRepairs: 2,
      timeoutMs: 60_000,
    })
  );

  // Node 3: extract answer from LLM response
  graph.addNode(
    new FnNode({
      id: 'format-response',
      fn: (ctx) => {
        const state = ctx.state as NodeChatState;
        const chatResult = state.chat;

        if (!chatResult || !chatResult.answer) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'LLM returned empty response' },
          };
        }

        return {
          kind: 'end' as const,
          statePatch: {
            answer: chatResult.answer,
            relatedNodes: chatResult.relatedNodes,
          },
        };
      },
    })
  );

  // Edges
  graph
    .from('build-node-chat-prompt')
    .to('chat')
    .when((ctx) => !(ctx.state as NodeChatState).error)
    .priority(1)
    .done();
  graph
    .from('build-node-chat-prompt')
    .to('END')
    .when((ctx) => !!(ctx.state as NodeChatState).error)
    .priority(0)
    .done();
  graph.from('chat').to('format-response').done();
  graph.from('format-response').to('END').done();

  return graph;
}

// ─── Runner ────────────────────────────────────────────────────────────────────

interface RunNodeChatInput {
  graph: JsonGraph;
  nodeId: string;
  nodeLabel: string;
  question: string;
  workspaceContext: string;
  history?: string;
}

export async function runNodeChat(input: RunNodeChatInput): Promise<{
  answer: string;
  relatedNodes?: string[];
}> {
  const graph = createNodeChatGraph();
  const runner = new GraphRunner(graph, { maxSteps: 10 });

  const initialState: NodeChatState = {
    graph: input.graph,
    nodeId: input.nodeId,
    nodeLabel: input.nodeLabel,
    question: input.question,
    workspaceContext: input.workspaceContext,
    history: input.history,
  };

  const result = await runner.run(initialState);
  const finalState = result.state as NodeChatState;

  if (finalState.error) {
    throw new Error(finalState.error);
  }

  return {
    answer: finalState.answer!,
    relatedNodes: finalState.relatedNodes,
  };
}
