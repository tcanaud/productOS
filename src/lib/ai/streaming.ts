import type { MessageStreamParams } from '@anthropic-ai/sdk/resources';
import { anthropic } from './client';

export interface StreamOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
}

/**
 * Stream an AI response as a ReadableStream of text chunks.
 * Intended for use in Next.js API routes (server-side only).
 */
export function streamAIResponse(
  userMessage: string,
  options: StreamOptions = {}
): ReadableStream<string> {
  const { model = 'claude-sonnet-4-6', maxTokens = 1024, system } = options;

  const params: MessageStreamParams = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userMessage }],
    ...(system ? { system } : {}),
  };

  return new ReadableStream<string>({
    async start(controller) {
      try {
        const stream = await anthropic.messages.stream(params);
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(event.delta.text);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
