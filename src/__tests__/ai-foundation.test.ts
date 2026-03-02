/**
 * Tests for Story 2.0: AI Client Foundation
 *
 * Covers:
 * - Structured output parsing (valid + invalid JSON)
 * - Retry logic (success after retry, max retries exceeded)
 * - Rate limiter (within limit, exceeded)
 * - Token tracker (correct values, cost estimation)
 * - Prompt template system
 * - Integration: build prompt → mock client → parse response → track
 */
import { z } from 'zod';
import {
  parseStructuredResponse,
  extractToolUseResult,
  StructuredOutputError,
} from '@/lib/ai/structured-output';
import { withRetry, AIError } from '@/lib/ai/error-handler';
import { checkRateLimit, resetRateLimit, clearAllRateLimits } from '@/lib/ai/rate-limiter';
import { estimateCostUsd } from '@/lib/ai/token-tracker';
import { buildPrompt, buildSystemPrompt, injectContext } from '@/lib/ai/prompts/base';
import { ENDPOINT_CONFIG, RATE_LIMITS } from '@/lib/ai/config';
import type { Message } from '@anthropic-ai/sdk/resources';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeTextMessage(text: string): Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  } as unknown as Message;
}

function makeToolUseMessage(toolName: string, input: unknown): Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'tool_use', id: 'tu_1', name: toolName, input }],
    model: 'claude-sonnet-4-6',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  } as unknown as Message;
}

const SimpleSchema = z.object({ value: z.string(), count: z.number().default(0) });

// ────────────────────────────────────────────────────────────────────────────
// Structured output parsing
// ────────────────────────────────────────────────────────────────────────────

describe('parseStructuredResponse', () => {
  it('parses valid JSON text block', () => {
    const msg = makeTextMessage(JSON.stringify({ value: 'hello', count: 3 }));
    const result = parseStructuredResponse(msg, SimpleSchema);
    expect(result.value).toBe('hello');
    expect(result.count).toBe(3);
  });

  it('parses JSON wrapped in code fence', () => {
    const msg = makeTextMessage('```json\n{"value": "fenced"}\n```');
    const result = parseStructuredResponse(msg, SimpleSchema);
    expect(result.value).toBe('fenced');
  });

  it('applies schema defaults for missing optional fields', () => {
    const msg = makeTextMessage(JSON.stringify({ value: 'only value' }));
    const result = parseStructuredResponse(msg, SimpleSchema);
    expect(result.count).toBe(0);
  });

  it('throws StructuredOutputError for invalid JSON', () => {
    const msg = makeTextMessage('not json at all {{{');
    expect(() => parseStructuredResponse(msg, SimpleSchema)).toThrow(StructuredOutputError);
  });

  it('throws StructuredOutputError for schema validation failure', () => {
    // count must be a number but we pass a string
    const msg = makeTextMessage(JSON.stringify({ value: 'test', count: 'not-a-number' }));
    expect(() => parseStructuredResponse(msg, SimpleSchema)).toThrow(StructuredOutputError);
  });

  it('throws StructuredOutputError when no text block', () => {
    const msg = makeToolUseMessage('some_tool', { value: 'x' });
    expect(() => parseStructuredResponse(msg, SimpleSchema)).toThrow(StructuredOutputError);
  });
});

describe('extractToolUseResult', () => {
  it('extracts and validates tool_use block', () => {
    const msg = makeToolUseMessage('my_tool', { value: 'from-tool', count: 5 });
    const result = extractToolUseResult(msg, SimpleSchema, 'my_tool');
    expect(result.value).toBe('from-tool');
    expect(result.count).toBe(5);
  });

  it('extracts first tool_use block when no name specified', () => {
    const msg = makeToolUseMessage('any_tool', { value: 'auto' });
    const result = extractToolUseResult(msg, SimpleSchema);
    expect(result.value).toBe('auto');
  });

  it('throws when named tool not found', () => {
    const msg = makeToolUseMessage('other_tool', { value: 'x' });
    expect(() => extractToolUseResult(msg, SimpleSchema, 'missing_tool')).toThrow(
      StructuredOutputError
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Retry logic
// ────────────────────────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('returns result on first successful call', async () => {
    const result = await withRetry(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('retries once and succeeds on second attempt', async () => {
    let attempts = 0;
    const result = await withRetry(
      () => {
        attempts++;
        if (attempts === 1) {
          throw new AIError('timeout', 'timeout', true);
        }
        return Promise.resolve('ok');
      },
      { maxRetries: 1, delayMs: 0 }
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('throws after max retries exceeded', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        () => {
          attempts++;
          throw new AIError('timeout', 'always fails', true);
        },
        { maxRetries: 1, delayMs: 0 }
      )
    ).rejects.toThrow(AIError);
    expect(attempts).toBe(2);
  });

  it('does not retry non-retryable errors', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        () => {
          attempts++;
          throw new AIError('api_error', 'fatal', false);
        },
        { maxRetries: 3, delayMs: 0 }
      )
    ).rejects.toThrow(AIError);
    expect(attempts).toBe(1);
  });
});

describe('AIError', () => {
  it('has correct properties', () => {
    const err = new AIError('rate_limit', 'too many', true, 30000);
    expect(err.type).toBe('rate_limit');
    expect(err.retryable).toBe(true);
    expect(err.retryAfterMs).toBe(30000);
    expect(err.name).toBe('AIError');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Rate limiter
// ────────────────────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  beforeEach(() => clearAllRateLimits());

  it('allows requests within the limit', () => {
    const result = checkRateLimit('user1', 'chat');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMITS.chat - 1);
  });

  it('tracks multiple requests correctly', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user2', 'review');
    }
    const result = checkRateLimit('user2', 'review');
    expect(result.remaining).toBe(RATE_LIMITS.review - 6);
  });

  it('blocks requests when limit is exceeded', () => {
    const limit = RATE_LIMITS['spec-generation']; // 5
    for (let i = 0; i < limit; i++) {
      checkRateLimit('user3', 'spec-generation');
    }
    const result = checkRateLimit('user3', 'spec-generation');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('isolates limits per user', () => {
    const limit = RATE_LIMITS['flow-generation'];
    for (let i = 0; i < limit; i++) {
      checkRateLimit('userA', 'flow-generation');
    }
    // userB should still be allowed
    const result = checkRateLimit('userB', 'flow-generation');
    expect(result.allowed).toBe(true);
  });

  it('isolates limits per endpoint', () => {
    const limit = RATE_LIMITS.chat;
    for (let i = 0; i < limit; i++) {
      checkRateLimit('user5', 'chat');
    }
    // same user, different endpoint should still be allowed
    const result = checkRateLimit('user5', 'review');
    expect(result.allowed).toBe(true);
  });

  it('resets after explicit reset', () => {
    checkRateLimit('user6', 'review');
    resetRateLimit('user6', 'review');
    const result = checkRateLimit('user6', 'review');
    expect(result.remaining).toBe(RATE_LIMITS.review - 1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Token tracker
// ────────────────────────────────────────────────────────────────────────────

describe('estimateCostUsd', () => {
  it('estimates cost for claude-sonnet-4-6', () => {
    const cost = estimateCostUsd('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      totalTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(3.0);
  });

  it('estimates cost for claude-opus-4-6', () => {
    const cost = estimateCostUsd('claude-opus-4-6', {
      inputTokens: 0,
      outputTokens: 1_000_000,
      totalTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(75.0);
  });

  it('returns non-zero cost for small usage', () => {
    const cost = estimateCostUsd('claude-sonnet-4-6', {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    expect(cost).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Prompt template system
// ────────────────────────────────────────────────────────────────────────────

describe('buildPrompt', () => {
  it('interpolates variables', () => {
    const result = buildPrompt('Hello {{name}}, you have {{count}} items.', {
      name: 'Alice',
      count: 3,
    });
    expect(result).toBe('Hello Alice, you have 3 items.');
  });

  it('leaves unknown placeholders as-is', () => {
    const result = buildPrompt('Hello {{unknown}}', { other: 'value' });
    expect(result).toBe('Hello {{unknown}}');
  });

  it('handles empty variables', () => {
    const result = buildPrompt('No variables here.', {});
    expect(result).toBe('No variables here.');
  });
});

describe('buildSystemPrompt', () => {
  it('builds prompt with persona only', () => {
    const result = buildSystemPrompt({ persona: 'a senior engineer' });
    expect(result).toContain('You are a senior engineer');
  });

  it('includes all sections when provided', () => {
    const result = buildSystemPrompt({
      persona: 'a PM',
      context: 'User onboarding flow',
      outputFormat: 'JSON',
    });
    expect(result).toContain('You are a PM');
    expect(result).toContain('User onboarding flow');
    expect(result).toContain('JSON');
  });

  it('returns empty string for empty options', () => {
    const result = buildSystemPrompt({});
    expect(result).toBe('');
  });
});

describe('injectContext', () => {
  it('prepends workspace context to prompt', () => {
    const result = injectContext('Do something.', {
      workspaceName: 'My App',
      workspaceDescription: 'A great app',
    });
    expect(result).toContain('Workspace: My App');
    expect(result).toContain('Do something.');
  });

  it('returns prompt unchanged when context is empty', () => {
    const result = injectContext('Original prompt.', {});
    expect(result).toBe('Original prompt.');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Config validation
// ────────────────────────────────────────────────────────────────────────────

describe('AI config', () => {
  it('has endpoint config for all endpoints', () => {
    const endpoints = ['flow-generation', 'review', 'spec-generation', 'chat'] as const;
    for (const endpoint of endpoints) {
      expect(ENDPOINT_CONFIG[endpoint]).toBeDefined();
      expect(ENDPOINT_CONFIG[endpoint].maxTokens).toBeGreaterThan(0);
      expect(ENDPOINT_CONFIG[endpoint].model).toBeTruthy();
    }
  });

  it('has rate limits for all endpoints', () => {
    const endpoints = ['flow-generation', 'review', 'spec-generation', 'chat'] as const;
    for (const endpoint of endpoints) {
      expect(RATE_LIMITS[endpoint]).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Integration: build prompt → mock message → parse → estimate cost
// ────────────────────────────────────────────────────────────────────────────

describe('Integration: prompt → parse → cost', () => {
  it('builds a prompt, parses a mocked response, and estimates cost', () => {
    // 1. Build prompt
    const prompt = buildPrompt('Analyze {{topic}} for workspace {{workspace}}.', {
      topic: 'login flow',
      workspace: 'Acme',
    });
    expect(prompt).toContain('login flow');
    expect(prompt).toContain('Acme');

    // 2. Simulate AI response (mocked message)
    const mockResponse = makeTextMessage(JSON.stringify({ value: 'analysis result', count: 5 }));

    // 3. Parse response
    const parsed = parseStructuredResponse(mockResponse, SimpleSchema);
    expect(parsed.value).toBe('analysis result');
    expect(parsed.count).toBe(5);

    // 4. Estimate cost from usage
    const usage = {
      inputTokens: mockResponse.usage.input_tokens,
      outputTokens: mockResponse.usage.output_tokens,
      totalTokens: mockResponse.usage.input_tokens + mockResponse.usage.output_tokens,
    };
    const cost = estimateCostUsd('claude-sonnet-4-6', usage);
    expect(cost).toBeGreaterThan(0);
  });
});
