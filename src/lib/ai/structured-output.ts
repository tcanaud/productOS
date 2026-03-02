import type { Message, ToolUseBlock } from '@anthropic-ai/sdk/resources';
import { z } from 'zod';

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StructuredOutputError';
  }
}

/**
 * Extract and validate a structured response from an Anthropic message.
 * Expects the message to contain a JSON text block.
 */
export function parseStructuredResponse<T>(response: Message, schema: z.ZodType<T>): T {
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new StructuredOutputError('No text block found in AI response');
  }

  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw];
  const jsonStr = (jsonMatch[1] ?? raw).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new StructuredOutputError(
      `Failed to parse JSON from AI response: ${jsonStr.slice(0, 200)}`
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new StructuredOutputError(
      `AI response failed schema validation: ${result.error.message}`,
      result.error
    );
  }
  return result.data;
}

/**
 * Extract the result from a tool_use block in an Anthropic message.
 */
export function extractToolUseResult<T>(
  response: Message,
  schema: z.ZodType<T>,
  toolName?: string
): T {
  const toolBlock = response.content.find(
    (block): block is ToolUseBlock =>
      block.type === 'tool_use' && (!toolName || block.name === toolName)
  );

  if (!toolBlock) {
    throw new StructuredOutputError(
      toolName
        ? `No tool_use block named '${toolName}' found in AI response`
        : 'No tool_use block found in AI response'
    );
  }

  const result = schema.safeParse(toolBlock.input);
  if (!result.success) {
    throw new StructuredOutputError(
      `Tool use result failed schema validation: ${result.error.message}`,
      result.error
    );
  }
  return result.data;
}
