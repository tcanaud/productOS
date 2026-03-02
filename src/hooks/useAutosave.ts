'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

type Options = {
  /** Interval in ms between autosave checks. Default: 5000 */
  intervalMs?: number;
  /** Skip save if the user typed within this many ms. Default: 1000 */
  debounceMs?: number;
  onSave: (content: string) => Promise<void>;
};

export function useAutosave(
  content: string,
  { intervalMs = 5000, debounceMs = 1000, onSave }: Options
) {
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const dirtyRef = useRef(false);
  const lastContentRef = useRef(content);
  const lastTypedRef = useRef<number>(Date.now());
  const onSaveRef = useRef(onSave);

  // Keep onSave ref fresh without re-triggering effects
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Track dirty state when content changes
  useEffect(() => {
    if (content !== lastContentRef.current) {
      dirtyRef.current = true;
      lastTypedRef.current = Date.now();
      setStatus('unsaved');
    }
  }, [content]);

  const flush = useCallback(async () => {
    if (!dirtyRef.current) return;
    setStatus('saving');
    try {
      await onSaveRef.current(content);
      lastContentRef.current = content;
      dirtyRef.current = false;
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [content]);

  // 5s interval autosave — skip if user typed within debounceMs
  useEffect(() => {
    const timer = setInterval(() => {
      if (!dirtyRef.current) return;
      const msSinceTyped = Date.now() - lastTypedRef.current;
      if (msSinceTyped < debounceMs) return;
      void flush();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [flush, intervalMs, debounceMs]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        void onSaveRef.current(lastContentRef.current === content ? content : content);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, flush };
}
