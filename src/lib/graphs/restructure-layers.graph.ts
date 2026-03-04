/**
 * restructure-layers.graph.ts — Story 11.1
 *
 * Claudegraph that analyzes a flat graph and proposes a hierarchical layer
 * decomposition via an interactive negotiation with the user.
 *
 * Flow:
 *   [analyze (FnNode)]
 *     → [propose (LLMNode)]
 *       → [present (AskHumanNode)]  — pauses, routes via onAnswer:
 *           • accept  → [apply (FnNode)] → END
 *           • adjust  → [propose] (loop)
 */
import { Graph, FnNode, LLMNode, AskHumanNode, GraphRunner } from 'claudegraph';
import { z } from 'zod';
import type { RestructureState, Cluster } from './restructure-layers.types';
import type { JsonGraph, GraphNode, GraphEdge } from '@/lib/json2mermaid/types';

// ── Zod schema for LLM output ─────────────────────────────────────────────────

const SuggestedPortSchema = z.object({
  name: z.string(),
  direction: z.enum(['input', 'output']),
  connectedNodeId: z.string(),
});

const ClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodeIds: z.array(z.string()),
  suggestedPorts: z.array(SuggestedPortSchema),
});

const ProposeOutputSchema = z.object({
  clusters: z.array(ClusterSchema),
  analysisNotes: z.string(),
});

// ── Max negotiation rounds before forcing confirmation ────────────────────────

const MAX_ROUNDS = 5;

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Compute out-degree + in-degree for each node. */
function computeDegrees(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const degreeMap = new Map<string, number>();
  for (const n of nodes) degreeMap.set(n.id, 0);
  for (const e of edges) {
    degreeMap.set(e.from, (degreeMap.get(e.from) ?? 0) + 1);
    degreeMap.set(e.to, (degreeMap.get(e.to) ?? 0) + 1);
  }
  return degreeMap;
}

/** Format cluster list as readable text for the AskHumanNode prompt. */
function formatClustersText(clusters: Cluster[]): string {
  return clusters
    .map((c, i) => {
      const portsText =
        c.suggestedPorts.length > 0
          ? `\n     Ports: ${c.suggestedPorts.map((p) => `${p.name} (${p.direction})`).join(', ')}`
          : '';
      return `  ${i + 1}. **${c.name}** — nodes: [${c.nodeIds.join(', ')}]${portsText}`;
    })
    .join('\n');
}

/** Apply finalClusters to the original graph — convert to composite nodes. */
function applyClustersMutation(originalGraph: JsonGraph, clusters: Cluster[]): JsonGraph {
  // Build a map: nodeId → clusterId
  const nodeToCluster = new Map<string, string>();
  const clusterNameMap = new Map<string, string>();
  for (const c of clusters) {
    clusterNameMap.set(c.id, c.name);
    for (const nid of c.nodeIds) {
      nodeToCluster.set(nid, c.id);
    }
  }

  // Nodes not assigned to any cluster remain in the graph
  const clusteredNodeIds = new Set(nodeToCluster.keys());
  const remainingNodes = originalGraph.nodes.filter((n) => !clusteredNodeIds.has(n.id));

  // Create one composite node per cluster
  const compositeNodes: GraphNode[] = clusters.map((c) => ({
    id: c.id,
    label: c.name,
    type: 'composite',
  }));

  // Remap edges: if from/to is a clustered node, replace with its cluster's composite node id
  const remapId = (id: string): string => nodeToCluster.get(id) ?? id;

  const remappedEdges: GraphEdge[] = originalGraph.edges
    .map((e) => ({
      ...e,
      from: remapId(e.from),
      to: remapId(e.to),
    }))
    // Remove self-loops created by intra-cluster edges
    .filter((e) => e.from !== e.to);

  // Deduplicate edges (same from/to/label combination)
  const edgeKey = (e: GraphEdge) => `${e.from}→${e.to}${e.label ? `:${e.label}` : ''}`;
  const seenEdges = new Set<string>();
  const deduplicatedEdges = remappedEdges.filter((e) => {
    const key = edgeKey(e);
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
    return true;
  });

  return {
    ...originalGraph,
    nodes: [...remainingNodes, ...compositeNodes],
    edges: deduplicatedEdges,
  };
}

// ── Graph factory ─────────────────────────────────────────────────────────────

export function createRestructureLayersGraph() {
  const graph = new Graph('analyze');

  // ── Node: analyze ──────────────────────────────────────────────────────────
  graph.addNode(
    new FnNode({
      id: 'analyze',
      fn: (ctx) => {
        const state = ctx.state as RestructureState;
        const { graph: jsonGraph } = state;

        if (!jsonGraph?.nodes?.length) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'No nodes in graph to analyze' },
          };
        }

        const degreeMap = computeDegrees(jsonGraph.nodes, jsonGraph.edges);
        const avgDegree =
          Array.from(degreeMap.values()).reduce((s, d) => s + d, 0) / jsonGraph.nodes.length;

        const nodeList = jsonGraph.nodes.map((n) => ({
          id: n.id,
          label: n.label,
          degree: degreeMap.get(n.id) ?? 0,
        }));
        const leafNodeIds = nodeList.filter((n) => n.degree <= 1).map((n) => n.id);
        const hubNodeIds = nodeList.filter((n) => n.degree > avgDegree * 1.5).map((n) => n.id);
        const edgeList = jsonGraph.edges.map((e) => ({
          from: e.from,
          to: e.to,
          ...(e.label ? { label: e.label } : {}),
        }));

        return {
          kind: 'continue' as const,
          statePatch: {
            _nodeList: nodeList,
            _edgeList: edgeList,
            _leafNodeIds: leafNodeIds,
            _hubNodeIds: hubNodeIds,
          },
        };
      },
    })
  );

  // ── Node: propose (LLMNode) ────────────────────────────────────────────────
  graph.addNode(
    new LLMNode({
      id: 'propose',
      provider: 'claude',
      providerOptions: { model: 'claude-opus-4-6' },
      schema: ProposeOutputSchema,
      prompt: (ctx) => {
        const state = ctx.state as RestructureState;
        const lang = state.language || 'English';
        const nodeList = state._nodeList ?? [];
        const edgeList = state._edgeList ?? [];
        const leafIds = state._leafNodeIds ?? [];
        const hubIds = state._hubNodeIds ?? [];
        const round = state.negotiationRound;
        const prevClusters = state.proposedClusters;
        const userFeedback = state.userFeedback;
        const fromScratch = state.fromScratch;

        const nodesText = nodeList
          .map((n) => `  - id: "${n.id}", label: "${n.label}", degree: ${n.degree}`)
          .join('\n');
        const edgesText = edgeList
          .map((e) => `  - "${e.from}" → "${e.to}"${e.label ? ` [${e.label}]` : ''}`)
          .join('\n');

        const modeInstructions: Record<string, string> = {
          'bottom-up':
            'Group leaf nodes (low connectivity) into clusters first, then build parent layers from these groups.',
          'top-down':
            'Identify major functional domains or bounded contexts first, then assign nodes to each domain.',
          hybrid:
            'Use a balanced approach: identify hub nodes as domain anchors, then cluster surrounding leaf nodes around them.',
        };

        const lines: string[] = [
          'You are an expert software architect specializing in modular system design.',
          'Analyze the following graph and propose a hierarchical layer decomposition.',
          '',
          `Decomposition mode: **${state.mode}**`,
          `Strategy: ${modeInstructions[state.mode] ?? modeInstructions.hybrid}`,
          '',
          'Graph nodes (id, label, connectivity degree):',
          nodesText,
          '',
          'Graph edges:',
          edgesText || '  (none)',
          '',
          `Leaf nodes (degree ≤ 1): [${leafIds.join(', ')}]`,
          `Hub nodes (high connectivity): [${hubIds.join(', ')}]`,
          '',
        ];

        if (round > 0 && prevClusters && !fromScratch) {
          const prevText = prevClusters
            .map((c) => `  - ${c.name}: [${c.nodeIds.join(', ')}]`)
            .join('\n');
          lines.push(`Previous proposal (round ${round}):`);
          lines.push(prevText);
          lines.push('');
        }

        if (userFeedback) {
          lines.push(`User adjustment request: "${userFeedback}"`);
          lines.push('Please update the clusters to satisfy this request.');
          lines.push('');
        }

        if (fromScratch) {
          lines.push(
            'The user requested a completely fresh proposal. Ignore all previous clusters.'
          );
          lines.push('');
        }

        if (round >= MAX_ROUNDS - 1) {
          lines.push(
            `Note: This is negotiation round ${round + 1}/${MAX_ROUNDS}. Please finalize the proposal.`
          );
          lines.push('');
        }

        lines.push(
          'Rules:',
          '- Create 2 to 6 clusters (composite nodes). Each cluster should have a clear single responsibility.',
          '- Every node must be assigned to exactly one cluster.',
          '- Cluster names should be concise PascalCase or noun phrases (e.g. "AuthModule", "DataPipeline").',
          '- For suggestedPorts: inspect cross-cluster edges. If an edge goes FROM cluster A node TO cluster B node,',
          '  cluster A needs an output port and cluster B needs an input port.',
          '- Ports should have descriptive names (e.g. "userCreated", "orderReceived").',
          '- analysisNotes: write a 2-3 sentence explanation of the decomposition rationale.',
          '',
          'Return a raw JSON object (NO markdown fences, NO ```json, NO commentary).',
          '{"clusters":[{"id":"<unique_slug>","name":"<Name>","nodeIds":["<id>"...],"suggestedPorts":[{"name":"<port>","direction":"input"|"output","connectedNodeId":"<id>"}...]}...],"analysisNotes":"<text>"}',
          `Write analysisNotes in ${lang}.`,
          'Your entire response must be parseable by JSON.parse() directly.'
        );

        return lines.join('\n');
      },
      maxRepairs: 2,
      timeoutMs: 180_000,
    })
  );

  // ── Node: present (AskHumanNode) ──────────────────────────────────────────
  graph.addNode(
    new AskHumanNode({
      id: 'present',
      key: (ctx) => {
        const state = ctx.state as RestructureState;
        return `restructure-round-${state.negotiationRound}`;
      },
      request: (ctx) => {
        const state = ctx.state as RestructureState;
        const clusters = state.proposedClusters ?? [];
        const round = state.negotiationRound;
        const notes = state.analysisNotes ?? '';
        const maxReached = round >= MAX_ROUNDS;

        const clustersText = formatClustersText(clusters);

        const parts: string[] = [
          round === 0
            ? '📊 Here is my proposed layer decomposition:'
            : `🔄 Updated proposal (round ${round + 1}):`,
          '',
          clustersText,
          '',
          ...(notes ? [`Analysis: ${notes}`, ''] : []),
        ];

        if (maxReached) {
          parts.push(
            '⚠️ Maximum negotiation rounds reached. Please accept or provide final adjustments.'
          );
        } else {
          parts.push(
            'Reply with:',
            '  • "accept" or "yes" to apply this decomposition',
            '  • Your adjustment instructions to modify the clusters',
            '  • "rethink" to start from scratch with a completely new proposal'
          );
        }

        return {
          key: `restructure-round-${round}`,
          kind: 'text' as const,
          prompt: parts.join('\n'),
        };
      },
      onAnswer: (ctx, answer: string) => {
        const state = ctx.state as RestructureState;
        const lower = (answer ?? '').toLowerCase().trim();

        // Force acceptance when max rounds reached
        if (state.negotiationRound >= MAX_ROUNDS) {
          return {
            statePatch: {
              finalClusters: state.proposedClusters,
            },
            next: 'apply',
          };
        }

        // Accept signals
        if (
          lower === 'accept' ||
          lower === 'yes' ||
          lower === 'ok' ||
          lower === 'yes!' ||
          lower.startsWith('accept') ||
          lower.startsWith('yes,') ||
          lower.startsWith('looks good') ||
          lower.startsWith('apply')
        ) {
          return {
            statePatch: {
              finalClusters: state.proposedClusters,
            },
            next: 'apply',
          };
        }

        // From-scratch signals
        if (
          lower.includes('rethink') ||
          lower.includes('from scratch') ||
          lower.includes('recommence') ||
          lower.includes('restart') ||
          lower.includes('start over')
        ) {
          return {
            statePatch: {
              fromScratch: true,
              userFeedback: undefined,
              proposedClusters: undefined,
              negotiationRound: state.negotiationRound + 1,
            },
            next: 'propose',
          };
        }

        // Adjustment — re-propose with user feedback
        return {
          statePatch: {
            userFeedback: answer,
            fromScratch: false,
            negotiationRound: state.negotiationRound + 1,
          },
          next: 'propose',
        };
      },
    })
  );

  // ── Node: apply (FnNode) ───────────────────────────────────────────────────
  graph.addNode(
    new FnNode({
      id: 'apply',
      fn: (ctx) => {
        const state = ctx.state as RestructureState;
        const clusters = state.finalClusters ?? state.proposedClusters ?? [];

        if (clusters.length === 0) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'No clusters to apply' },
          };
        }

        const updatedGraph = applyClustersMutation(state.graph, clusters);

        return {
          kind: 'end' as const,
          statePatch: { updatedGraph },
        };
      },
    })
  );

  // ── Edges ──────────────────────────────────────────────────────────────────

  // analyze → propose (unless error)
  graph
    .from('analyze')
    .to('propose')
    .when((ctx) => !(ctx.state as RestructureState).error)
    .priority(1)
    .done();
  graph
    .from('analyze')
    .to('END')
    .when((ctx) => !!(ctx.state as RestructureState).error)
    .priority(0)
    .done();

  // propose → present
  graph.from('propose').to('present').done();

  // present routes via onAnswer (no explicit edges needed — AskHumanNode returns `next` directly)

  // apply → END
  graph.from('apply').to('END').done();

  return graph;
}

// ── Runner ─────────────────────────────────────────────────────────────────────

export async function runRestructureLayers(
  initialState: RestructureState
): Promise<{ clusters: Cluster[]; updatedGraph?: JsonGraph; error?: string }> {
  const graph = createRestructureLayersGraph();
  const runner = new GraphRunner(graph, { maxSteps: 30 });

  const result = await runner.run(initialState);
  const state = result.state as RestructureState;

  if (state.error) {
    return { clusters: [], error: state.error };
  }

  return {
    clusters: state.finalClusters ?? state.proposedClusters ?? [],
    ...(state.updatedGraph ? { updatedGraph: state.updatedGraph } : {}),
  };
}
