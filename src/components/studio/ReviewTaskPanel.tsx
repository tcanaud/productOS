'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, MessageCircle, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LiveReviewItem } from '@/lib/session/types';

const SEVERITY_CONFIG = {
  medium: { color: 'bg-yellow-500', label: 'Medium', textColor: 'text-yellow-700 dark:text-yellow-400' },
  high: { color: 'bg-orange-500', label: 'High', textColor: 'text-orange-700 dark:text-orange-400' },
  critical: { color: 'bg-red-500', label: 'Critical', textColor: 'text-red-700 dark:text-red-400' },
} as const;

interface ReviewTaskPanelProps {
  items: LiveReviewItem[];
  isAnalyzing: boolean;
  onReanalyze: () => void;
  onDismiss: (id: string) => void;
  onSendToChat: (item: LiveReviewItem) => void;
}

export function ReviewTaskPanel({
  items,
  isAnalyzing,
  onReanalyze,
  onDismiss,
  onSendToChat,
}: ReviewTaskPanelProps) {
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissingIds((prev) => new Set(prev).add(id));
      // Wait for slide-out animation before removing
      setTimeout(() => {
        onDismiss(id);
        setDismissingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    },
    [onDismiss]
  );

  const activeItems = items.filter((item) => !item.dismissedAt);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Live Review</h3>
          {activeItems.length > 0 && (
            <Badge variant="outline" className="text-xs tabular-nums">
              {activeItems.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={onReanalyze}
          disabled={isAnalyzing}
          className="gap-1.5"
        >
          {isAnalyzing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {isAnalyzing && activeItems.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Analyzing with Opus...</p>
            <p className="text-xs">Deep contextual review in progress</p>
          </div>
        )}

        {/* Empty state */}
        {!isAnalyzing && activeItems.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium">All clear!</p>
            <p className="text-xs">Re-analyze when you&apos;re ready for a fresh review.</p>
          </div>
        )}

        {/* Review items */}
        {activeItems.length > 0 && (
          <ul className="divide-y divide-border">
            {activeItems.map((item) => {
              const isDismissing = dismissingIds.has(item.id);
              const severity = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG];

              return (
                <li
                  key={item.id}
                  className={cn(
                    'px-4 py-3 transition-all duration-300',
                    isDismissing && 'translate-x-full opacity-0'
                  )}
                >
                  {/* Severity + message */}
                  <div className="flex items-start gap-2">
                    <span
                      className={cn('mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full', severity?.color ?? 'bg-gray-400')}
                      title={severity?.label ?? item.severity}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-medium', severity?.textColor)}>
                        {item.message}
                      </p>
                      {item.description && (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      {item.suggestions && item.suggestions.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {item.suggestions.map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <span className="mt-0.5 text-primary">-</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex items-center gap-1.5 pl-4">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => onSendToChat(item)}
                      title="Discuss in chat"
                    >
                      <MessageCircle className="h-3 w-3" />
                      Discuss
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="gap-1 text-muted-foreground hover:text-green-600"
                      onClick={() => handleDismiss(item.id)}
                      title="Dismiss"
                    >
                      <Check className="h-3 w-3" />
                      Done
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
