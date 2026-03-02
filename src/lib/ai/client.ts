import Anthropic from '@anthropic-ai/sdk';

function createAnthropicClient(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Please configure it in your environment variables.'
    );
  }
  return new Anthropic({ apiKey, timeout: 30000 });
}

// Singleton with hot-reload guard (same pattern as prisma.ts)
const globalForAI = globalThis as unknown as { anthropic?: Anthropic };

export const anthropic = globalForAI.anthropic ?? createAnthropicClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForAI.anthropic = anthropic;
}
