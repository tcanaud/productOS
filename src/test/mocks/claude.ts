/**
 * Claude API mock fixtures for tests.
 *
 * Usage:
 *   import { mockClaudeClient, mockFlowGenerationResponse } from '@/test/mocks/claude';
 *   vi.mock('@anthropic-ai/sdk', () => ({ default: mockClaudeClient }));
 */
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Pre-built response fixtures
// ---------------------------------------------------------------------------

export const mockFlowGenerationResponse = {
  id: 'msg_mock_flow',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        nodes: [
          { id: 'start', label: 'Start', type: 'start' },
          { id: 'process', label: 'Process', type: 'process' },
          { id: 'end', label: 'End', type: 'end' },
        ],
        edges: [
          { from: 'start', to: 'process' },
          { from: 'process', to: 'end' },
        ],
      }),
    },
  ],
  model: 'claude-sonnet-4-6',
  stop_reason: 'end_turn',
  usage: { input_tokens: 100, output_tokens: 200 },
};

export const mockReviewResponse = {
  id: 'msg_mock_review',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        summary: 'Code review completed successfully.',
        issues: [
          {
            severity: 'low',
            description: 'Consider adding JSDoc comments',
            file: 'src/lib/auth.ts',
          },
        ],
        suggestions: ['Add error boundaries for async operations'],
        score: 85,
      }),
    },
  ],
  model: 'claude-sonnet-4-6',
  stop_reason: 'end_turn',
  usage: { input_tokens: 500, output_tokens: 300 },
};

export const mockSpecGenerationResponse = {
  id: 'msg_mock_spec',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        prd: {
          title: 'Generated Product Requirements',
          overview: 'Auto-generated PRD based on the provided context.',
          features: ['Feature A', 'Feature B'],
        },
        stories: [
          { id: 'S1', title: 'Story 1', description: 'As a user...' },
          { id: 'S2', title: 'Story 2', description: 'As a developer...' },
        ],
      }),
    },
  ],
  model: 'claude-sonnet-4-6',
  stop_reason: 'end_turn',
  usage: { input_tokens: 800, output_tokens: 600 },
};

export const mockChatResponse = {
  id: 'msg_mock_chat',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'This is a mock chat response from a persona.',
    },
  ],
  model: 'claude-sonnet-4-6',
  stop_reason: 'end_turn',
  usage: { input_tokens: 150, output_tokens: 80 },
};

// ---------------------------------------------------------------------------
// Error factories
// ---------------------------------------------------------------------------

export type ClaudeErrorType = 'rate_limit' | 'timeout' | 'invalid_response' | 'api_error';

export function mockClaudeError(type: ClaudeErrorType): Error {
  switch (type) {
    case 'rate_limit':
      return Object.assign(new Error('Rate limit exceeded'), { status: 429 });
    case 'timeout':
      return Object.assign(new Error('Request timed out'), { code: 'ETIMEDOUT' });
    case 'invalid_response':
      return new Error('Invalid response format from Claude API');
    case 'api_error':
      return Object.assign(new Error('Internal server error'), { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Mock Anthropic client
// ---------------------------------------------------------------------------

export const mockClaudeClient = {
  messages: {
    create: vi.fn().mockResolvedValue(mockChatResponse),
  },
};

export function resetClaudeMocks() {
  mockClaudeClient.messages.create.mockResolvedValue(mockChatResponse);
}
