/**
 * Simplify Node Graph — claudegraph
 *
 * Merges a node and its immediate neighbors into fewer, clearer steps:
 *
 *   [build-simplify-prompt] → [simplify (LLMNode)] → [patch-graph] → END
 */
import { z } from 'zod';
import { Graph, FnNode, LLMNode, GraphRunner } from 'claudegraph';
import type { JsonGraph, GraphNode, GraphEdge, NodeShape } from '@/lib/json2mermaid/types';
import { patchGraph } from '@/lib/graph/patch-graph';

// ─── Zod schema for LLM output ─────────────────────────────────────────────────

const GraphFragmentSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      shape: z.string().optional(),
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

interface SimplifyNodeState {
  graph: JsonGraph;
  nodeId: string;
  // Set by build-simplify-prompt
  nodeLabel?: string;
  subgraphText?: string;
  neighborIds?: string[];
  // Set by LLMNode (keyed as state.simplify)
  simplify?: z.infer<typeof GraphFragmentSchema>;
  // Set by patch-graph
  result?: JsonGraph;
  error?: string;
}

// ─── Graph factory ─────────────────────────────────────────────────────────────

export function createSimplifyNodeGraph() {
  const graph = new Graph('build-simplify-prompt');

  // Node 1: extract sub-graph (target + depth-1 neighbors)
  graph.addNode(
    new FnNode({
      id: 'build-simplify-prompt',
      fn: (ctx) => {
        const state = ctx.state as SimplifyNodeState;
        const { graph: jsonGraph, nodeId } = state;

        const targetNode = jsonGraph.nodes.find((n) => n.id === nodeId);
        if (!targetNode) {
          return {
            kind: 'end' as const,
            statePatch: { error: `Node "${nodeId}" not found in graph` },
          };
        }

        // Collect immediate neighbor ids (depth 1)
        const neighborIds = new Set<string>();
        jsonGraph.edges.forEach((e) => {
          if (e.from === nodeId) neighborIds.add(e.to);
          if (e.to === nodeId) neighborIds.add(e.from);
        });
        const subgraphNodeIds = [nodeId, ...neighborIds];

        const subNodes: GraphNode[] = jsonGraph.nodes.filter((n) => subgraphNodeIds.includes(n.id));
        const subEdges: GraphEdge[] = jsonGraph.edges.filter(
          (e) => subgraphNodeIds.includes(e.from) && subgraphNodeIds.includes(e.to)
        );

        const subgraphText = JSON.stringify({ nodes: subNodes, edges: subEdges }, null, 2);

        return {
          kind: 'continue' as const,
          statePatch: {
            nodeLabel: targetNode.label,
            subgraphText,
            neighborIds: [...neighborIds],
          },
        };
      },
    })
  );

  // Node 2: LLMNode — ask Claude to simplify
  graph.addNode(
    new LLMNode({
      id: 'simplify',
      provider: 'claude',
      schema: GraphFragmentSchema,
      prompt: (ctx) => {
        const state = ctx.state as SimplifyNodeState;
        return [
          'You are a business process analyst simplifying part of a workflow diagram.',
          '',
          `Target node: "${state.nodeLabel}" (id: ${state.nodeId})`,
          'Sub-graph to simplify (nodes + edges within 1 hop):',
          state.subgraphText ?? '',
          '',
          'Simplify this sub-graph by merging redundant or trivial steps.',
          'Aim to reduce the number of nodes while preserving the essential logic.',
          '',
          'Return a JSON object with this exact shape:',
          '{ "nodes": [{ "id": string, "label": string, "shape"?: string }], "edges": [{ "from": string, "to": string, "label"?: string }] }',
          '',
          'Rules:',
          '- Preserve all external connections (edges entering/leaving the sub-graph boundary)',
          '- Node ids must be unique strings (use snake_case)',
          '- Use appropriate shape values: "rect" (action/process), "round" (soft action/note), "rhombus" (decision/condition), "stadium" (start/end/milestone), "circle" (connector), "cylinder" (database/storage), "subroutine" (sub-process), "hexagon" (preparation/setup), "parallelogram" (input/output), "trapezoid" (manual operation)',
          '- Return ONLY the JSON object, no markdown, no commentary',
        ].join('\n');
      },
      maxRepairs: 2,
      timeoutMs: 120_000,
    })
  );

  // Node 3: patch the graph — remove target node + neighbors, insert simplified fragment
  graph.addNode(
    new FnNode({
      id: 'patch-graph',
      fn: (ctx) => {
        const state = ctx.state as SimplifyNodeState;
        const fragment = state.simplify;

        if (!fragment || !fragment.nodes.length) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'LLM returned empty fragment' },
          };
        }

        // Remove target + neighbors from base, then insert the fragment.
        // We do this iteratively: first remove neighbors (no boundary rewiring needed
        // since they're interior to the sub-graph), then replace the target node
        // with the fragment (boundary edges get rewired by patchGraph).
        const neighborIds = state.neighborIds ?? [];

        // Build an intermediate graph without the neighbor nodes
        // (their incident edges to the target are also removed — patchGraph handles
        //  only the target node's external boundary, which is what we want).
        const withoutNeighbors: JsonGraph = {
          ...state.graph,
          nodes: state.graph.nodes.filter((n) => !neighborIds.includes(n.id)),
          edges: state.graph.edges.filter(
            (e) => !neighborIds.includes(e.from) && !neighborIds.includes(e.to)
          ),
        };

        const fragmentGraph: JsonGraph = {
          diagramType: state.graph.diagramType,
          nodes: fragment.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            ...(n.shape ? { shape: n.shape as NodeShape } : {}),
          })),
          edges: fragment.edges,
        };

        const result = patchGraph(withoutNeighbors, fragmentGraph, state.nodeId);

        return {
          kind: 'end' as const,
          statePatch: { result },
        };
      },
    })
  );

  // Edges
  graph
    .from('build-simplify-prompt')
    .to('simplify')
    .when((ctx) => !(ctx.state as SimplifyNodeState).error)
    .priority(1)
    .done();
  graph
    .from('build-simplify-prompt')
    .to('END')
    .when((ctx) => !!(ctx.state as SimplifyNodeState).error)
    .priority(0)
    .done();
  graph.from('simplify').to('patch-graph').done();
  graph.from('patch-graph').to('END').done();

  return graph;
}

// ─── Runner ────────────────────────────────────────────────────────────────────

export async function runSimplifyNode(jsonGraph: JsonGraph, nodeId: string): Promise<JsonGraph> {
  const graph = createSimplifyNodeGraph();
  const runner = new GraphRunner(graph, { maxSteps: 10 });

  const initialState: SimplifyNodeState = { graph: jsonGraph, nodeId };
  const result = await runner.run(initialState);
  const finalState = result.state as SimplifyNodeState;

  if (finalState.error) {
    throw new Error(finalState.error);
  }

  return finalState.result!;
}
