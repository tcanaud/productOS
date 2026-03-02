import type { AIEndpoint, AIModel } from './config';
import { ENDPOINT_CONFIG } from './config';
import type { TokenUsage } from './token-tracker';
import type { ReviewOutput } from './schemas/review-output';
import type { SpecOutput } from './schemas/spec-output';
import type { ChatResponse } from './schemas/chat-response';
import type { DiagramType } from '@/lib/json2mermaid/types';
import { json2mermaid } from '@/lib/json2mermaid';
import { anthropic } from './client';
import { parseStructuredResponse } from './structured-output';
import { withRetry } from './error-handler';
import { GenerateFlowResponseSchema } from './schemas/generate-flow-response';
import { buildFlowGenerationPrompt } from './prompts/flow-generation';

export interface AIResult<T> {
  data: T;
  usage: TokenUsage;
  latencyMs: number;
}

export interface GenerateFlowOptions {
  userId: string;
  workspaceId?: string;
  model?: AIModel;
  diagramType?: DiagramType | 'auto';
}

export interface GenerateFlowResult {
  graph: import('./schemas/generate-flow-response').GenerateFlowResponse;
  mermaidSyntax: string;
  explanation: string;
  usage: TokenUsage;
  latencyMs: number;
}

export interface ReviewDiagramOptions {
  userId: string;
  workspaceId?: string;
  model?: AIModel;
}

export interface GenerateSpecsOptions {
  userId: string;
  workspaceId?: string;
  model?: AIModel;
}

export interface ChatOptions {
  userId: string;
  workspaceId?: string;
  model?: AIModel;
}

/**
 * AI service facade.
 *
 * These methods are thin stubs that define the interface for each AI feature.
 * Actual prompt content and implementation are defined in each feature story
 * (2.2 for generateFlow, 3.1 for reviewDiagram, 4.1 for generateSpecs, 5.1 for chat).
 *
 * All methods follow the pattern:
 *   build prompt → call client with withRetry → parse output → track tokens → return AIResult<T>
 */
export const aiService = {
  /**
   * Generate a flow diagram from a natural language description.
   * Implemented in Story 2.2.
   */
  generateFlow: async (
    description: string,
    options: GenerateFlowOptions
  ): Promise<GenerateFlowResult> => {
    const diagramType = options.diagramType ?? 'auto';
    const config = ENDPOINT_CONFIG['flow-generation'];
    const model = options.model ?? config.model;
    const { system, user } = buildFlowGenerationPrompt(description, diagramType);

    const start = Date.now();

    const response = await withRetry(
      () =>
        anthropic.messages.create({
          model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      { maxRetries: 1 }
    );

    const latencyMs = Date.now() - start;

    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    const graph = parseStructuredResponse(response, GenerateFlowResponseSchema);

    // Cast to JsonGraph-compatible type for json2mermaid
    const jsonGraph = {
      diagramType: graph.diagramType,
      direction: graph.direction,
      title: graph.title,
      nodes: graph.nodes,
      edges: graph.edges,
    };

    const mermaidSyntax = json2mermaid(jsonGraph as import('@/lib/json2mermaid/types').JsonGraph);

    return {
      graph,
      mermaidSyntax,
      explanation: graph.explanation,
      usage,
      latencyMs,
    };
  },

  /**
   * Review a Mermaid diagram against a named profile.
   * Implemented in Story 3.1.
   */
  reviewDiagram: async (
    _diagram: string,
    _profile: string,
    _options: ReviewDiagramOptions
  ): Promise<AIResult<ReviewOutput>> => {
    throw new Error('reviewDiagram: not yet implemented (Story 3.1)');
  },

  /**
   * Generate PRD / user stories / edge cases from a diagram + reviews.
   * Implemented in Story 4.1.
   */
  generateSpecs: async (
    _diagram: string,
    _reviews: ReviewOutput[],
    _options: GenerateSpecsOptions
  ): Promise<AIResult<SpecOutput>> => {
    throw new Error('generateSpecs: not yet implemented (Story 4.1)');
  },

  /**
   * Multi-persona chat over a diagram context.
   * Implemented in Story 5.1.
   */
  chat: async (
    _messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    _personas: string[],
    _context: string,
    _options: ChatOptions
  ): Promise<AIResult<ChatResponse>> => {
    throw new Error('chat: not yet implemented (Story 5.1)');
  },
};

export type { AIEndpoint };
