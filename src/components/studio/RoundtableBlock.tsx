'use client';

import type { RoundtableData } from './StudioLayout';

interface RoundtableBlockProps {
  data: RoundtableData;
  onSuggestionClick?: (suggestion: string) => void;
}

/**
 * Renders the roundtable synthesis block after persona messages:
 * - 1-2 thematic questions from the expert panel
 * - 2-3 clickable suggestion chips (AI-generated assumptions the user can confirm)
 */
export function RoundtableBlock({ data, onSuggestionClick }: RoundtableBlockProps) {
  if (data.questions.length === 0 && data.suggestions.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-border bg-muted/30 p-4 animate-in fade-in"
      style={{ animationDelay: '100ms', animationFillMode: 'both', animationDuration: '200ms' }}
    >
      {/* Questions */}
      {data.questions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Questions pour vous
          </p>
          {data.questions.map((q, i) => (
            <p key={i} className="text-sm text-foreground">
              {q}
            </p>
          ))}
        </div>
      )}

      {/* Suggestion chips */}
      {data.suggestions.length > 0 && (
        <div className={data.questions.length > 0 ? 'mt-3 pt-3 border-t border-border/40' : ''}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {data.suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSuggestionClick?.(s)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
