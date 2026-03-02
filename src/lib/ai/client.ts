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

// Lazy singleton — only created on first access, avoids crash at module load
// when ANTHROPIC_API_KEY is not set (e.g. when using claudegraph CLI instead).
const globalForAI = globalThis as unknown as { anthropic?: Anthropic };

export function getAnthropicClient(): Anthropic {
  if (!globalForAI.anthropic) {
    globalForAI.anthropic = createAnthropicClient();
  }
  return globalForAI.anthropic;
}

/** @deprecated Use getAnthropicClient() for lazy initialization */
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return Reflect.get(getAnthropicClient(), prop);
  },
});
