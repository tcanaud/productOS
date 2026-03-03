'use client';

/**
 * InteractionWidget — Story 6.6: SSE/Streaming Communication
 *
 * Renders when an `interaction` SSE event arrives, blocking further
 * event processing until the user responds.
 *
 * On submit, calls the `onRespond` callback which posts to the backend
 * to resume the graph run.
 */
import { useState } from 'react';
import type { InteractionPayload } from '@/lib/sse/sse.types';

interface InteractionWidgetProps {
  payload: InteractionPayload;
  onRespond: (answer: string) => void;
  disabled?: boolean;
}

export function InteractionWidget({
  payload,
  onRespond,
  disabled = false,
}: InteractionWidgetProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onRespond(value.trim());
    setValue('');
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">{payload.question}</p>

      {payload.inputType === 'text' && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type your answer…"
            disabled={disabled}
            autoFocus
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}

      {(payload.inputType === 'select' || payload.inputType === 'multiselect') &&
        payload.options && (
          <div className="flex flex-wrap gap-2">
            {payload.options.map((option) => (
              <button
                key={option}
                onClick={() => onRespond(option)}
                disabled={disabled}
                className="rounded-full border border-border bg-background px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
              >
                {option}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
