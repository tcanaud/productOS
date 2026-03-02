import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AIEndpoint } from './config';
import { checkRateLimit } from './rate-limiter';
import { AIError } from './error-handler';

export type AIRouteHandler = (req: NextRequest, userId: string) => Promise<NextResponse>;

/**
 * Wrap an AI route handler with per-user rate limiting.
 * Extracts userId from headers set by auth middleware.
 */
export function withAIRateLimit(handler: AIRouteHandler, endpoint: AIEndpoint): AIRouteHandler {
  return async (req: NextRequest, userId: string) => {
    const result = checkRateLimit(userId, endpoint);

    if (!result.allowed) {
      const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
      return NextResponse.json(
        {
          error: {
            type: 'rate_limit',
            message: `Rate limit exceeded for ${endpoint}. Please try again later.`,
            retryAfter: retryAfterSec,
          },
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSec) },
        }
      );
    }

    return handler(req, userId);
  };
}

/**
 * Wrap an AI route handler with consistent error handling.
 * Converts AIError and unexpected errors into structured JSON responses.
 */
export function withAIErrorHandling(handler: AIRouteHandler): AIRouteHandler {
  return async (req: NextRequest, userId: string) => {
    try {
      return await handler(req, userId);
    } catch (error) {
      if (error instanceof AIError) {
        const status = error.type === 'rate_limit' ? 429 : 500;
        return NextResponse.json(
          {
            error: {
              type: error.type,
              message: error.message,
              ...(error.retryAfterMs ? { retryAfter: Math.ceil(error.retryAfterMs / 1000) } : {}),
            },
          },
          { status }
        );
      }

      console.error('[AI Middleware] Unexpected error:', error);
      return NextResponse.json(
        {
          error: {
            type: 'api_error',
            message: 'An unexpected error occurred. Please try again.',
          },
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Compose rate limiting + error handling into a single middleware.
 * Usage: withAI(handler, 'flow-generation')
 */
export function withAI(handler: AIRouteHandler, endpoint: AIEndpoint): AIRouteHandler {
  return withAIErrorHandling(withAIRateLimit(handler, endpoint));
}
