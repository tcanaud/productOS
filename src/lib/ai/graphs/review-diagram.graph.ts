/**
 * Review Diagram Graph — claudegraph
 *
 * Replaces the direct anthropic.messages.create() call in aiService.reviewDiagram
 * with a claudegraph workflow:
 *
 *   [prepare] → [review (LLMNode)] → END
 *
 * The LLMNode spawns the Claude CLI, sends the review prompt with the
 * selected profile persona, and validates the response against the
 * MultiProfileReview Zod schema with auto-repair.
 */
import { Graph, FnNode, LLMNode, GraphRunner } from 'claudegraph';
import { MultiProfileReviewSchema } from '../schemas/review-output';
import type { ReviewProfile } from '../schemas/review-output';
import {
  buildReviewSystemPrompt,
  buildReviewUserPrompt,
  extractMermaidNodes,
} from '../prompts/review-profiles';

// --- Graph State ---
export interface ReviewDiagramState {
  // Input
  diagram: string;
  profile: ReviewProfile;
  // Set by prepare node
  systemPrompt?: string;
  userPrompt?: string;
  // Set by LLMNode (auto-keyed as state.review)
  review?: {
    profile: string;
    summary: string;
    edgeCases: Array<{
      description: string;
      severity: string;
      affectedNodes: string[];
    }>;
    risks: Array<{
      description: string;
      likelihood: string;
      impact: string;
      affectedNodes: string[];
    }>;
    inconsistencies: Array<{
      description: string;
      affectedNodes: string[];
    }>;
    suggestions: Array<{
      description: string;
      actionable: boolean;
      targetNode: string;
    }>;
  };
  error?: string;
}

/**
 * Build and return a review-diagram graph instance.
 */
export function createReviewDiagramGraph() {
  const graph = new Graph('prepare');

  // --- Node 1: Extract nodes & build prompts ---
  graph.addNode(
    new FnNode({
      id: 'prepare',
      fn: (ctx) => {
        const { diagram, profile } = ctx.state as ReviewDiagramState;

        if (!diagram || diagram.trim().length === 0) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'Diagram content is required' },
          };
        }

        const nodes = extractMermaidNodes(diagram);
        const systemPrompt = buildReviewSystemPrompt(profile);
        const userPrompt = buildReviewUserPrompt(diagram, nodes, profile);

        return {
          kind: 'continue' as const,
          statePatch: { systemPrompt, userPrompt },
        };
      },
    })
  );

  // --- Node 2: Call Claude CLI to review the diagram ---
  graph.addNode(
    new LLMNode({
      id: 'review',
      provider: 'claude',
      schema: MultiProfileReviewSchema,
      prompt: (ctx) => {
        const state = ctx.state as ReviewDiagramState;
        return `${state.systemPrompt}\n\n${state.userPrompt}`;
      },
      maxRepairs: 2,
      timeoutMs: 120_000,
    })
  );

  // --- Edges ---
  graph
    .from('prepare')
    .to('review')
    .when((ctx) => !ctx.state.error)
    .priority(1)
    .done();
  graph
    .from('prepare')
    .to('END')
    .when((ctx) => !!ctx.state.error)
    .priority(0)
    .done();
  graph.from('review').to('END').done();

  return graph;
}

/**
 * Execute the review-diagram graph.
 */
export async function runReviewDiagramGraph(diagram: string, profile: ReviewProfile) {
  const graph = createReviewDiagramGraph();
  const runner = new GraphRunner(graph, {
    maxSteps: 10,
  });

  const initialState: ReviewDiagramState = {
    diagram,
    profile,
  };

  const result = await runner.run(initialState);
  const finalState = result.state as ReviewDiagramState;

  if (finalState.error) {
    throw new Error(finalState.error);
  }

  return {
    review: finalState.review!,
  };
}
