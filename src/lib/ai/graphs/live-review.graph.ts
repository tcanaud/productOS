/**
 * Live Review Graph — claudegraph
 *
 * Asynchronous, lightweight review of diagram nodes:
 *
 *   [extract-nodes] → [review (LLMNode)] → [map-annotations] → END
 *
 * Returns Annotation[] — ephemeral per-session, never persisted to DB.
 */
import { z } from 'zod';
import { Graph, FnNode, LLMNode, GraphRunner } from 'claudegraph';
import type { JsonGraph } from '@/lib/json2mermaid/types';

// ─── Public types ──────────────────────────────────────────────────────────────

export type Severity = 'ok' | 'medium' | 'high' | 'critical';

export interface Annotation {
  nodeId: string;
  severity: Severity;
  message: string;
  description?: string;
  suggestions?: string[];
}

// ─── Internal graph state ──────────────────────────────────────────────────────

interface LiveReviewState {
  graph: JsonGraph;
  // Set by extract-nodes
  nodeList?: { id: string; label: string }[];
  nodesText?: string;
  // Set by LLMNode (keyed by node id: 'review')
  review?: unknown;
  // Set by map-annotations
  mappedAnnotations?: Annotation[];
  error?: string;
}

// ─── Zod schema for LLM output ─────────────────────────────────────────────────

const AnnotationRawSchema = z.array(
  z.object({
    nodeId: z.string(),
    severity: z.enum(['ok', 'medium', 'high', 'critical']),
    message: z.string().max(200),
    description: z.string().optional(),
    suggestions: z.array(z.string()).optional(),
  })
);

// ─── Graph factory ─────────────────────────────────────────────────────────────

export function createLiveReviewGraph() {
  const graph = new Graph('extract-nodes');

  // Node 1: extract node list from JsonGraph
  graph.addNode(
    new FnNode({
      id: 'extract-nodes',
      fn: (ctx) => {
        const { graph: jsonGraph } = ctx.state as LiveReviewState;

        if (!jsonGraph?.nodes?.length) {
          return {
            kind: 'end' as const,
            statePatch: { mappedAnnotations: [], error: 'No nodes to review' },
          };
        }

        const nodeList = jsonGraph.nodes.map((n) => ({ id: n.id, label: n.label }));
        const nodesText = nodeList.map((n) => `- id: "${n.id}", label: "${n.label}"`).join('\n');

        return {
          kind: 'continue' as const,
          statePatch: { nodeList, nodesText },
        };
      },
    })
  );

  // Node 2: LLMNode — ask Claude to identify issues per node
  graph.addNode(
    new LLMNode({
      id: 'review',
      provider: 'claude',
      schema: AnnotationRawSchema,
      prompt: (ctx) => {
        const state = ctx.state as LiveReviewState;
        return [
          'You are a product process analyst reviewing a business flow diagram.',
          'Given the following list of nodes (each with an id and a label), identify potential issues,',
          'missing edge cases, or risks for each node that warrants attention.',
          '',
          'Nodes:',
          state.nodesText ?? '',
          '',
          'Return a JSON array. Each element must have:',
          '- "nodeId": the exact node id from the input',
          '- "severity": one of "ok" | "medium" | "high" | "critical"',
          '- "message": a single sentence (max 120 chars) summarizing the issue',
          '- "description": optional, longer explanation',
          '- "suggestions": optional array of actionable suggestions',
          '',
          'Return ONLY the JSON array, no markdown, no commentary.',
          'Omit nodes that have no issues (severity "ok" entries are optional).',
        ].join('\n');
      },
      maxRepairs: 2,
      timeoutMs: 60_000,
    })
  );

  // Node 3: map & validate LLM output against known nodeIds
  graph.addNode(
    new FnNode({
      id: 'map-annotations',
      fn: (ctx) => {
        const state = ctx.state as LiveReviewState;
        const raw = state.review;
        const nodeIds = new Set((state.nodeList ?? []).map((n) => n.id));

        let parsed: z.infer<typeof AnnotationRawSchema>;
        try {
          parsed = AnnotationRawSchema.parse(raw);
        } catch {
          return {
            kind: 'end' as const,
            statePatch: { mappedAnnotations: [], error: 'LLM output failed schema validation' },
          };
        }

        const mapped: Annotation[] = parsed
          .filter((a) => nodeIds.has(a.nodeId) && a.severity !== 'ok')
          .map((a) => ({
            nodeId: a.nodeId,
            severity: a.severity as Severity,
            message: a.message,
            ...(a.description ? { description: a.description } : {}),
            ...(a.suggestions?.length ? { suggestions: a.suggestions } : {}),
          }));

        return {
          kind: 'end' as const,
          statePatch: { mappedAnnotations: mapped },
        };
      },
    })
  );

  // Edges
  graph
    .from('extract-nodes')
    .to('review')
    .when((ctx) => !(ctx.state as LiveReviewState).error)
    .priority(1)
    .done();
  graph
    .from('extract-nodes')
    .to('END')
    .when((ctx) => !!(ctx.state as LiveReviewState).error)
    .priority(0)
    .done();
  graph.from('review').to('map-annotations').done();
  graph.from('map-annotations').to('END').done();

  return graph;
}

// ─── Runner ────────────────────────────────────────────────────────────────────

export async function runLiveReview(jsonGraph: JsonGraph): Promise<Annotation[]> {
  const graph = createLiveReviewGraph();
  const runner = new GraphRunner(graph, { maxSteps: 10 });

  const initialState: LiveReviewState = { graph: jsonGraph };
  const result = await runner.run(initialState);
  const finalState = result.state as LiveReviewState;

  return finalState.mappedAnnotations ?? [];
}
