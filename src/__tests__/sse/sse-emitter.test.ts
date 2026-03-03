/**
 * Tests for Story 6.6: SSEEmitter
 *
 * Verifies:
 * - SSE frame format (id:, event:, data: fields)
 * - Heartbeat comment format
 * - close() ends the stream
 * - emit() after close() is a no-op
 */
import { describe, it, expect } from 'vitest';
import { createSSEStream, SSE_HEADERS } from '@/lib/sse/sse-emitter';

describe('createSSEStream', () => {
  it('returns a ReadableStream and an SSEEmitter', () => {
    const { stream, emitter } = createSSEStream();
    expect(stream).toBeInstanceOf(ReadableStream);
    expect(typeof emitter.emit).toBe('function');
    expect(typeof emitter.close).toBe('function');
    expect(typeof emitter.heartbeat).toBe('function');
    emitter.close();
  });

  it('emits a correctly formatted SSE frame', async () => {
    const { stream, emitter } = createSSEStream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    // Emit a persona-message event
    emitter.emit('persona-message', {
      persona: 'john',
      displayName: 'Product Strategist',
      icon: '📋',
      message: 'Hello from John',
    });
    emitter.close();

    const chunks: string[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(decoder.decode(result.value));
      }
    }

    const fullOutput = chunks.join('');
    expect(fullOutput).toContain('event: persona-message');
    expect(fullOutput).toContain('data: ');
    expect(fullOutput).toContain('"persona":"john"');
    expect(fullOutput).toContain('id: ');
    // SSE frame must end with double newline
    expect(fullOutput).toContain('\n\n');
  });

  it('emits a heartbeat comment', async () => {
    const { stream, emitter } = createSSEStream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    emitter.heartbeat();
    emitter.close();

    const chunks: string[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(decoder.decode(result.value));
    }

    const fullOutput = chunks.join('');
    expect(fullOutput).toContain(': heartbeat');
  });

  it('emit() after close() is a safe no-op', () => {
    const { emitter } = createSSEStream();
    emitter.close();
    // Should not throw
    expect(() => emitter.emit('session-end', { summary: 'done' })).not.toThrow();
  });

  it('close() is idempotent', () => {
    const { emitter } = createSSEStream();
    expect(() => {
      emitter.close();
      emitter.close();
    }).not.toThrow();
  });

  it('serializes event data as JSON in the data: field', async () => {
    const { stream, emitter } = createSSEStream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    emitter.emit('interaction', {
      question: 'What is your goal?',
      inputType: 'text',
    });
    emitter.close();

    const chunks: string[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(decoder.decode(result.value));
    }

    const fullOutput = chunks.join('');
    const dataLine = fullOutput.split('\n').find((l) => l.startsWith('data: '));
    expect(dataLine).toBeDefined();
    const parsed = JSON.parse(dataLine!.slice(6));
    expect(parsed.question).toBe('What is your goal?');
    expect(parsed.inputType).toBe('text');
  });
});

describe('SSE_HEADERS', () => {
  it('includes required SSE headers', () => {
    expect(SSE_HEADERS['Content-Type']).toBe('text/event-stream');
    expect(SSE_HEADERS['Cache-Control']).toBe('no-cache');
    expect(SSE_HEADERS['Connection']).toBe('keep-alive');
    expect(SSE_HEADERS['X-Accel-Buffering']).toBe('no');
  });
});
