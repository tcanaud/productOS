import type { AIEndpoint, AIModel } from './config';
import { ENDPOINT_CONFIG } from './config';
import type { TokenUsage } from './token-tracker';
import type { ReviewOutput } from './schemas/review-output';
import type { MultiProfileReview } from './schemas/review-output';
import type { GeneratedSpec } from './schemas/spec-output';
import { GeneratedSpecSchema } from './schemas/spec-output';
import type { ChatResponse } from './schemas/chat-response';
import { PersonaResponseSchema } from './schemas/chat-response';
import { selectPersonas } from './persona-selector';
import { PERSONAS } from './prompts/personas';
import type { DiagramType } from '@/lib/json2mermaid/types';
import { anthropic } from './client';
import { parseStructuredResponse } from './structured-output';
import { withRetry } from './error-handler';
import { runGenerateFlowGraph, runReviewDiagramGraph } from './graphs';
import { extractMermaidNodes } from './prompts/review-profiles';
import { buildSpecSystemPrompt, buildSpecUserPrompt } from './prompts/spec-generation';

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

export interface ReviewDiagramResult {
  review: MultiProfileReview;
  usage: TokenUsage;
  latencyMs: number;
}

export interface GenerateSpecsOptions {
  userId: string;
  workspaceId?: string;
  model?: AIModel;
  reviewContext?: string;
}

export interface GenerateSpecsResult {
  spec: GeneratedSpec;
  usage: TokenUsage;
  latencyMs: number;
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

    const start = Date.now();

    const result = await runGenerateFlowGraph(description, diagramType);

    const latencyMs = Date.now() - start;

    return {
      graph: result.graph as GenerateFlowResult['graph'],
      mermaidSyntax: result.mermaidSyntax,
      explanation: result.explanation,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      latencyMs,
    };
  },

  /**
   * Review a Mermaid diagram against a named profile.
   * Implemented in Story 3.1.
   */
  reviewDiagram: async (
    diagram: string,
    profile: string,
    options: ReviewDiagramOptions
  ): Promise<ReviewDiagramResult> => {
    const validatedProfile = (['optimist', 'moderate', 'critic'] as const).includes(
      profile as 'optimist' | 'moderate' | 'critic'
    )
      ? (profile as 'optimist' | 'moderate' | 'critic')
      : 'moderate';

    const start = Date.now();

    const result = await runReviewDiagramGraph(diagram, validatedProfile);

    const latencyMs = Date.now() - start;

    return {
      review: result.review as MultiProfileReview,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      latencyMs,
    };
  },

  /**
   * Generate PRD / user stories / edge cases from a diagram + reviews.
   * Implemented in Story 4.1.
   */
  generateSpecs: async (
    diagram: string,
    _reviews: ReviewOutput[],
    options: GenerateSpecsOptions
  ): Promise<GenerateSpecsResult> => {
    const config = ENDPOINT_CONFIG['spec-generation'];
    const model = options.model ?? config.model;
    const nodes = extractMermaidNodes(diagram);
    const system = buildSpecSystemPrompt();
    const user = buildSpecUserPrompt(diagram, nodes, options.reviewContext);

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

    const spec = parseStructuredResponse(response, GeneratedSpecSchema);

    return { spec, usage, latencyMs };
  },

  /**
   * Multi-persona chat over workspace context.
   * Implemented in Story 5.1.
   */
  chat: async (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    personaIds: string[],
    context: string,
    options: ChatOptions
  ): Promise<AIResult<ChatResponse>> => {
    const config = ENDPOINT_CONFIG['chat'];
    const model = options.model ?? config.model;

    // Determine which personas will respond
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const selectedIds =
      personaIds.length >= 2 ? personaIds.slice(0, 3) : selectPersonas(lastUserMessage, messages);

    // Summarize history if > 10 messages (keep last 10, prepend summary line)
    let history = messages;
    if (messages.length > 10) {
      const omittedCount = messages.length - 10;
      const summaryLine = {
        role: 'user' as const,
        content: `[Earlier in conversation: ${omittedCount} message(s) summarized]`,
      };
      history = [summaryLine, ...messages.slice(-10)];
    }

    // Build conversation history string for user prompt
    const historyText = history
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const turn = Math.floor(messages.filter((m) => m.role === 'user').length);

    const start = Date.now();

    // Parallel LLM calls for each selected persona
    const personaResults = await Promise.all(
      selectedIds.map(async (personaId) => {
        const persona = PERSONAS[personaId as keyof typeof PERSONAS];
        if (!persona) return null;

        const system = `${persona.systemPrompt}\n\n${context}`;
        const userPrompt = historyText
          ? `${historyText}\n\nUser: ${lastUserMessage}`
          : `User: ${lastUserMessage}`;

        const response = await withRetry(
          () =>
            anthropic.messages.create({
              model,
              max_tokens: config.maxTokens,
              temperature: config.temperature,
              system,
              messages: [{ role: 'user', content: userPrompt }],
            }),
          { maxRetries: 1 }
        );

        const parsed = parseStructuredResponse(response, PersonaResponseSchema);

        return {
          parsed,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        };
      })
    );

    const latencyMs = Date.now() - start;

    const responses = personaResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => r.parsed);

    const totalUsage: TokenUsage = personaResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .reduce(
        (acc, r) => ({
          inputTokens: acc.inputTokens + r.usage.inputTokens,
          outputTokens: acc.outputTokens + r.usage.outputTokens,
          totalTokens: acc.totalTokens + r.usage.totalTokens,
        }),
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      );

    const data: ChatResponse = { responses, turn };

    return { data, usage: totalUsage, latencyMs };
  },
};

export type { AIEndpoint };
