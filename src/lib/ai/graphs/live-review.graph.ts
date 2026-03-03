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
  /** Output language for annotations (from BMAD config). Defaults to 'English'. */
  language: string;
  // Set by extract-nodes
  nodeList?: { id: string; label: string }[];
  nodesText?: string;
  edgesText?: string;
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

  // Node 1: extract full graph context (nodes + edges) from JsonGraph
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
        const nodesText = nodeList
          .map((n) => `- id: "${n.id}", label: "${n.label}"`)
          .join('\n');
        const edgesText = (jsonGraph.edges ?? [])
          .map((e) => `- "${e.from}" → "${e.to}"${e.label ? ` [${e.label}]` : ''}`)
          .join('\n');

        return {
          kind: 'continue' as const,
          statePatch: { nodeList, nodesText, edgesText },
        };
      },
    })
  );

  // Node 2: LLMNode — Opus-powered contextual review
  graph.addNode(
    new LLMNode({
      id: 'review',
      provider: 'claude',
      providerOptions: { model: 'claude-opus-4-6' },
      schema: AnnotationRawSchema,
      prompt: (ctx) => {
        const state = ctx.state as LiveReviewState;
        const lang = state.language || 'English';
        const diagramType = state.graph.diagramType ?? 'flowchart';
        const title = state.graph.title ? `Diagram title: "${state.graph.title}"` : '';
        return [
          'You are an expert process modeler and systems architect.',
          'Analyze this business flow diagram in depth, considering both its structure and the domain it represents.',
          '',
          title,
          `Diagram type: ${diagramType}`,
          '',
          'Nodes:',
          state.nodesText ?? '',
          '',
          'Edges (connections):',
          state.edgesText ?? '(none)',
          '',
          'Perform a multi-level analysis:',
          '1. **Structural integrity**: orphan nodes, dead ends, missing error/exception paths, unreachable nodes, cycles without exit.',
          '2. **Semantic coherence**: node naming consistency, logical ordering of steps, missing intermediate steps.',
          '3. **Domain best practices**: based on the detected domain (e-commerce, auth, data pipeline, etc.), flag missing industry-standard steps (e.g. validation, error handling, notifications, rollback).',
          '4. **Flow completeness**: missing alternative paths (happy path vs error path), missing start/end nodes, ambiguous branching.',
          '',
          'Rules:',
          '- Return 5 to 8 high-quality observations, sorted by severity (critical first).',
          '- Quality over quantity: each observation must be insightful and actionable.',
          '- Every observation MUST include "suggestions" with at least one concrete fix.',
          '- Only flag genuine issues. Return [] if the diagram is well-designed.',
          '',
          'Return a raw JSON array (NO markdown fences, NO ```json blocks, NO commentary before/after).',
          'Each element: {"nodeId":"<exact id>","severity":"medium"|"high"|"critical","message":"<max 120 chars>","description":"<detailed explanation>","suggestions":["<concrete action>"]}',
          'Your entire response must be parseable by JSON.parse() directly.',
          `Write all "message", "description" and "suggestions" values in ${lang}.`,
        ].join('\n');
      },
      maxRepairs: 2,
      timeoutMs: 2*180_000,
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

export async function runLiveReview(
  jsonGraph: JsonGraph,
  language = 'English'
): Promise<Annotation[]> {
  const graph = createLiveReviewGraph();
  const runner = new GraphRunner(graph, { maxSteps: 10 });

  const initialState: LiveReviewState = { graph: jsonGraph, language };
  const result = await runner.run(initialState);
  const finalState = result.state as LiveReviewState;

  return finalState.mappedAnnotations ?? [];
}
