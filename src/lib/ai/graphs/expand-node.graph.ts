/**
 * Expand Node Graph — claudegraph
 *
 * Replaces a single node with a detailed sub-flow of 3–6 steps:
 *
 *   [build-expand-prompt] → [expand (LLMNode)] → [patch-graph] → END
 */
import { z } from 'zod';
import { Graph, FnNode, LLMNode, GraphRunner } from 'claudegraph';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import { patchGraph } from '@/lib/graph/patch-graph';

// ─── Zod schema for LLM output ─────────────────────────────────────────────────

const GraphFragmentSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
    })
  ),
});

// ─── Internal graph state ──────────────────────────────────────────────────────

interface ExpandNodeState {
  graph: JsonGraph;
  nodeId: string;
  // Set by build-expand-prompt
  nodeLabel?: string;
  predecessors?: string;
  successors?: string;
  // Set by LLMNode (keyed as state.expand)
  expand?: z.infer<typeof GraphFragmentSchema>;
  // Set by patch-graph
  result?: JsonGraph;
  error?: string;
}

// ─── Graph factory ─────────────────────────────────────────────────────────────

export function createExpandNodeGraph() {
  const graph = new Graph('build-expand-prompt');

  // Node 1: extract target node context
  graph.addNode(
    new FnNode({
      id: 'build-expand-prompt',
      fn: (ctx) => {
        const state = ctx.state as ExpandNodeState;
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

  // Node 2: LLMNode — ask Claude to expand the node
  graph.addNode(
    new LLMNode({
      id: 'expand',
      provider: 'claude',
      schema: GraphFragmentSchema,
      prompt: (ctx) => {
        const state = ctx.state as ExpandNodeState;
        return [
          'You are a business process analyst expanding a step in a workflow diagram.',
          '',
          `Target node: "${state.nodeLabel}" (id: ${state.nodeId})`,
          `Incoming steps: ${state.predecessors}`,
          `Outgoing steps: ${state.successors}`,
          '',
          `Expand "${state.nodeLabel}" into a detailed sub-flow of 3–6 steps that fully describes`,
          'what happens inside this step.',
          '',
          'Return a JSON object with this exact shape:',
          '{ "nodes": [{ "id": string, "label": string }], "edges": [{ "from": string, "to": string, "label"?: string }] }',
          '',
          'Rules:',
          `- The first node in your list receives all incoming connections of "${state.nodeId}"`,
          `- The last node in your list receives all outgoing connections of "${state.nodeId}"`,
          '- Node ids must be unique strings (use snake_case)',
          '- Return ONLY the JSON object, no markdown, no commentary',
        ].join('\n');
      },
      maxRepairs: 2,
      timeoutMs: 120_000,
    })
  );

  // Node 3: patch the graph
  graph.addNode(
    new FnNode({
      id: 'patch-graph',
      fn: (ctx) => {
        const state = ctx.state as ExpandNodeState;
        const fragment = state.expand;

        if (!fragment || !fragment.nodes.length) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'LLM returned empty fragment' },
          };
        }

        const fragmentGraph: JsonGraph = {
          diagramType: state.graph.diagramType,
          nodes: fragment.nodes,
          edges: fragment.edges,
        };

        const result = patchGraph(state.graph, fragmentGraph, state.nodeId);

        return {
          kind: 'end' as const,
          statePatch: { result },
        };
      },
    })
  );

  // Edges
  graph
    .from('build-expand-prompt')
    .to('expand')
    .when((ctx) => !(ctx.state as ExpandNodeState).error)
    .priority(1)
    .done();
  graph
    .from('build-expand-prompt')
    .to('END')
    .when((ctx) => !!(ctx.state as ExpandNodeState).error)
    .priority(0)
    .done();
  graph.from('expand').to('patch-graph').done();
  graph.from('patch-graph').to('END').done();

  return graph;
}

// ─── Runner ────────────────────────────────────────────────────────────────────

export async function runExpandNode(jsonGraph: JsonGraph, nodeId: string): Promise<JsonGraph> {
  const graph = createExpandNodeGraph();
  const runner = new GraphRunner(graph, { maxSteps: 10 });

  const initialState: ExpandNodeState = { graph: jsonGraph, nodeId };
  const result = await runner.run(initialState);
  const finalState = result.state as ExpandNodeState;

  if (finalState.error) {
    throw new Error(finalState.error);
  }

  return finalState.result!;
}
