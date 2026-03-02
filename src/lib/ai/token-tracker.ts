import type { AIEndpoint, AIModel } from './config';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TrackUsageParams {
  userId: string;
  workspaceId?: string;
  endpoint: AIEndpoint;
  model: AIModel;
  usage: TokenUsage;
  latencyMs: number;
  success: boolean;
}

/**
 * Approximate cost per 1M tokens in USD (as of 2025).
 * Used for logging/estimation only — not billed via this app.
 */
const COST_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
};

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const rates = COST_PER_M_TOKENS[model] ?? { input: 3.0, output: 15.0 };
  return (usage.inputTokens * rates.input + usage.outputTokens * rates.output) / 1_000_000;
}

/**
 * Log AI usage to the database.
 * Uses the AIUsageLog model added in Story 2.0 migration.
 * Imported lazily to avoid importing PrismaClient in test environments.
 */
export async function trackUsage(params: TrackUsageParams): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  // Access via bracket notation since the Prisma client may not be regenerated
  // until the migration runs. The model name is AIUsageLog → aIUsageLog in camelCase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).aIUsageLog.create({
    data: {
      userId: params.userId,
      workspaceId: params.workspaceId ?? null,
      endpoint: params.endpoint,
      model: params.model,
      inputTokens: params.usage.inputTokens,
      outputTokens: params.usage.outputTokens,
      latencyMs: params.latencyMs,
      success: params.success,
    },
  });
}
