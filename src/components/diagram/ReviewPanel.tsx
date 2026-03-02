'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ReviewCard } from './ReviewCard';
import type { MultiProfileReview } from '@/lib/ai/schemas/review-output';

type ReviewProfile = 'optimist' | 'moderate' | 'critic';

const PROFILES: { value: ReviewProfile; label: string; description: string }[] = [
  { value: 'optimist', label: 'Optimist', description: 'Opportunities & strengths' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced analysis' },
  { value: 'critic', label: 'Critic', description: 'Risks & failure modes' },
];

type Props = {
  diagramId: string;
  diagramContent: string;
};

type ReviewResponse = MultiProfileReview & { latencyMs?: number };

export function ReviewPanel({ diagramId, diagramContent }: Props) {
  const [activeProfile, setActiveProfile] = useState<ReviewProfile>('moderate');
  const [isLoading, setIsLoading] = useState(false);
  const [review, setReview] = useState<ReviewResponse | null>(null);

  const handleAnalyze = async () => {
    if (!diagramContent.trim()) {
      toast.error('The diagram is empty. Add some content before reviewing.');
      return;
    }

    setIsLoading(true);
    setReview(null);

    try {
      const res = await fetch('/api/ai/review-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagramId,
          content: diagramContent,
          profile: activeProfile,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as ReviewResponse;
      setReview(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Review failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Profile selector tabs */}
      <div className="border-b px-3 pt-3">
        <div className="flex gap-1">
          {PROFILES.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                setActiveProfile(p.value);
                setReview(null);
              }}
              disabled={isLoading}
              className={`rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
                activeProfile === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              title={p.description}
              aria-pressed={activeProfile === p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analyze button */}
      <div className="px-3 py-2">
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              Analyzing ({activeProfile})…
            </>
          ) : (
            `Analyze as ${activeProfile.charAt(0).toUpperCase() + activeProfile.slice(1)}`
          )}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {review ? (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            {review.summary && (
              <div className="rounded border bg-muted/30 p-3">
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Summary
                </p>
                <p className="text-xs leading-relaxed">{review.summary}</p>
                {review.latencyMs && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generated in {(review.latencyMs / 1000).toFixed(1)}s
                  </p>
                )}
              </div>
            )}

            {/* Edge Cases */}
            {review.edgeCases.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Edge Cases ({review.edgeCases.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {review.edgeCases.map((ec, i) => (
                    <ReviewCard
                      key={i}
                      type="edge-case"
                      description={ec.description}
                      severity={ec.severity}
                      affectedNodes={ec.affectedNodes}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Risks */}
            {review.risks.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Risks ({review.risks.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {review.risks.map((r, i) => (
                    <ReviewCard
                      key={i}
                      type="risk"
                      description={r.description}
                      affectedNodes={r.affectedNodes}
                      extra={`Likelihood: ${r.likelihood} / Impact: ${r.impact}`}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Inconsistencies */}
            {review.inconsistencies.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Inconsistencies ({review.inconsistencies.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {review.inconsistencies.map((inc, i) => (
                    <ReviewCard
                      key={i}
                      type="inconsistency"
                      description={inc.description}
                      affectedNodes={inc.affectedNodes}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Suggestions */}
            {review.suggestions.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggestions ({review.suggestions.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {review.suggestions.map((s, i) => (
                    <ReviewCard
                      key={i}
                      type="suggestion"
                      description={s.description}
                      targetNode={s.targetNode}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : !isLoading ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Select a profile and click Analyze to get AI feedback on your diagram.
          </p>
        ) : null}
      </div>
    </div>
  );
}
