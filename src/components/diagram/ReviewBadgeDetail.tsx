'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Annotation, Severity } from '@/lib/ai/graphs/live-review.graph';

const SEVERITY_LABEL: Record<Severity, string> = {
  ok: 'OK',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  ok: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
};

interface ReviewBadgeDetailProps {
  annotation: Annotation;
  onClose: () => void;
}

/**
 * Floating detail panel for a review badge.
 * Shows severity, message, optional description, and suggestions.
 * Closes on Escape key or backdrop click.
 */
export function ReviewBadgeDetail({ annotation, onClose }: ReviewBadgeDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const severityClass = SEVERITY_COLOR[annotation.severity] ?? SEVERITY_COLOR.medium;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" aria-hidden="true" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Review detail for node ${annotation.nodeId}`}
        className="fixed bottom-6 right-6 z-50 w-80 rounded-lg border border-border bg-background shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${severityClass}`}
            >
              {SEVERITY_LABEL[annotation.severity]}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {annotation.nodeId}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{annotation.message}</p>

          {annotation.description && (
            <p className="text-muted-foreground">{annotation.description}</p>
          )}

          {annotation.suggestions && annotation.suggestions.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-foreground">Suggestions</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {annotation.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
