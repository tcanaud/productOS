import Anthropic from '@anthropic-ai/sdk';

export type AIErrorType = 'rate_limit' | 'timeout' | 'invalid_response' | 'api_error' | 'unknown';

export class AIError extends Error {
  constructor(
    public readonly type: AIErrorType,
    message: string,
    public readonly retryable: boolean,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
}

function classifyError(error: unknown): AIError {
  if (error instanceof AIError) return error;

  if (error instanceof Anthropic.APIError) {
    if (error.status === 429) {
      const retryAfter = Number(error.headers?.['retry-after'] ?? 30);
      return new AIError(
        'rate_limit',
        `Rate limit exceeded: ${error.message}`,
        true,
        retryAfter * 1000
      );
    }
    if (error.status === 408 || error.message.toLowerCase().includes('timeout')) {
      return new AIError('timeout', `Request timed out: ${error.message}`, true);
    }
    return new AIError(
      'api_error',
      `Anthropic API error (${error.status}): ${error.message}`,
      false
    );
  }

  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('timeout')) {
      return new AIError('timeout', error.message, true);
    }
    if (error.name === 'StructuredOutputError') {
      return new AIError('invalid_response', error.message, true);
    }
  }

  return new AIError('unknown', String(error), false);
}

/**
 * Wrap an async function with retry logic.
 * Retries once by default on retryable errors.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 1, delayMs = 1000 } = options;
  let lastError: AIError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = classifyError(error);

      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError;
      }

      const waitMs = lastError.retryAfterMs ?? delayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError!;
}
