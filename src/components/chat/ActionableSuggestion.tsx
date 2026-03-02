'use client';

import { toast } from 'sonner';
import type { Suggestion } from '@/lib/ai/schemas/chat-response';

const TYPE_ICON: Record<Suggestion['type'], string> = {
  'edge-case': '⚠️',
  requirement: '📋',
  'diagram-edit': '✏️',
  note: '📝',
};

type Props = {
  suggestion: Suggestion;
};

export function ActionableSuggestion({ suggestion }: Props) {
  const handleApply = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.payload);
      toast.success(`Copied: "${suggestion.label}"`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <button
      onClick={handleApply}
      title={suggestion.payload}
      className="inline-flex items-center gap-1.5 rounded border border-dashed px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      <span aria-hidden="true">{TYPE_ICON[suggestion.type]}</span>
      {suggestion.label}
    </button>
  );
}
