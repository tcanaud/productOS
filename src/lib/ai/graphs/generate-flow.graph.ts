/**
 * Generate Flow Graph — claudegraph POC
 *
 * Replaces the direct anthropic.messages.create() call in aiService.generateFlow
 * with a claudegraph workflow:
 *
 *   [validate] → [generate (LLMNode)] → [convert (json2mermaid)] → END
 *
 * LLMNode spawns the Claude CLI via the registry adapter, validates the response
 * against a Zod schema with auto-repair, and auto-wraps the result into
 * state.generate (keyed by node id).
 */
import { Graph, FnNode, LLMNode, GraphRunner } from 'claudegraph';
import { z } from 'zod';
import { buildFlowGenerationPrompt } from '../prompts/flow-generation';
import { json2mermaid } from '@/lib/json2mermaid';
import type { DiagramType, NodeShape, EdgeType, JsonGraph } from '@/lib/json2mermaid/types';

// --- Schema for LLMNode output ---
// LLMNode auto-wraps parsed data into { kind: "continue", statePatch: { [nodeId]: data } }
// So the schema only needs to match what Claude actually returns.
const GenerateFlowSchema = z.object({
  diagramType: z.enum(['flowchart', 'stateDiagram', 'sequenceDiagram']),
  direction: z.enum(['TD', 'TB', 'BT', 'LR', 'RL']).optional(),
  title: z.string().optional().default(''),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        shape: z.string().optional(),
      })
    )
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
  explanation: z.string().default(''),
});

// --- Graph State ---
export interface GenerateFlowState {
  // Input
  description: string;
  diagramType: DiagramType | 'auto';
  // Set by validate node
  systemPrompt?: string;
  userPrompt?: string;
  // Set by LLMNode (auto-keyed as state.generate)
  generate?: {
    diagramType: string;
    direction?: string;
    title: string;
    nodes: Array<{ id: string; label: string; shape?: string }>;
    edges: Array<{ from: string; to: string; label?: string; type?: string }>;
    explanation: string;
  };
  // Set by convert node
  mermaidSyntax?: string;
  error?: string;
}

/**
 * Build and return a generate-flow graph instance.
 */
export function createGenerateFlowGraph() {
  const graph = new Graph('validate');

  // --- Node 1: Validate input & build prompts ---
  graph.addNode(
    new FnNode({
      id: 'validate',
      fn: (ctx) => {
        const { description, diagramType } = ctx.state as GenerateFlowState;

        if (!description || description.length < 10) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'Description must be at least 10 characters' },
          };
        }
        if (description.length > 2000) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'Description must be at most 2000 characters' },
          };
        }

        const { system, user } = buildFlowGenerationPrompt(description, diagramType ?? 'auto');

        return {
          kind: 'continue' as const,
          statePatch: { systemPrompt: system, userPrompt: user },
        };
      },
    })
  );

  // --- Node 2: Call Claude CLI to generate the flow ---
  // LLMNode uses the "claude" provider (default) which spawns the CLI.
  // It auto-wraps the parsed response into state.generate = { ...parsedData }
  graph.addNode(
    new LLMNode({
      id: 'generate',
      provider: 'claude',
      schema: GenerateFlowSchema,
      prompt: (ctx) => {
        const state = ctx.state as GenerateFlowState;
        return `${state.systemPrompt}\n\n${state.userPrompt}`;
      },
      maxRepairs: 2,
      timeoutMs: 60_000,
    })
  );

  // --- Node 3: Convert JSON graph to Mermaid syntax ---
  graph.addNode(
    new FnNode({
      id: 'convert',
      fn: (ctx) => {
        const state = ctx.state as GenerateFlowState;
        const generated = state.generate;

        if (!generated) {
          return {
            kind: 'end' as const,
            statePatch: { error: 'No generated data from Claude' },
          };
        }

        const jsonGraph: JsonGraph = {
          diagramType: generated.diagramType as DiagramType,
          direction: generated.direction as JsonGraph['direction'],
          title: generated.title,
          nodes: generated.nodes.map((n) => ({
            ...n,
            shape: n.shape as NodeShape | undefined,
          })),
          edges: generated.edges.map((e) => ({
            ...e,
            type: e.type as EdgeType | undefined,
          })),
        };

        const mermaidSyntax = json2mermaid(jsonGraph);

        return {
          kind: 'continue' as const,
          statePatch: { mermaidSyntax },
        };
      },
    })
  );

  // --- Edges ---
  graph
    .from('validate')
    .to('generate')
    .when((ctx) => !ctx.state.error)
    .priority(1)
    .done();
  graph
    .from('validate')
    .to('END')
    .when((ctx) => !!ctx.state.error)
    .priority(0)
    .done();
  graph.from('generate').to('convert').done();
  graph.from('convert').to('END').done();

  return graph;
}

/**
 * Execute the generate-flow graph.
 */
export async function runGenerateFlowGraph(
  description: string,
  diagramType: DiagramType | 'auto' = 'auto'
) {
  const graph = createGenerateFlowGraph();
  const runner = new GraphRunner(graph, {
    maxSteps: 10,
  });

  const initialState: GenerateFlowState = {
    description,
    diagramType,
  };

  const result = await runner.run(initialState);

  const finalState = result.state as GenerateFlowState;

  if (finalState.error) {
    throw new Error(finalState.error);
  }

  return {
    graph: finalState.generate!,
    mermaidSyntax: finalState.mermaidSyntax!,
    explanation: finalState.generate!.explanation,
  };
}
