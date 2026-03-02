'use client';

import { useCallback, useRef, useState } from 'react';

export interface UseAIStreamResult {
  data: string;
  isStreaming: boolean;
  error: string | null;
  cancel: () => void;
  stream: (url: string, body: unknown) => Promise<void>;
}

/**
 * React hook for consuming SSE / chunked AI streaming responses.
 * Sends a POST request and reads the response as a stream of text chunks.
 */
export function useAIStream(): UseAIStreamResult {
  const [data, setData] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const stream = useCallback(async (url: string, body: unknown) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setData('');
    setError(null);
    setIsStreaming(true);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setData((prev) => prev + chunk);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { data, isStreaming, error, cancel, stream };
}
