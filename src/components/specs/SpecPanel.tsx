'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PRDView } from './PRDView';
import { StoriesList } from './StoriesList';
import { EdgeCasesTable } from './EdgeCasesTable';
import { ExportButton } from './ExportButton';
import type { GeneratedSpec } from '@/lib/ai/schemas/spec-output';

type SpecTab = 'prd' | 'stories' | 'edge-cases';

type Props = {
  diagramId: string;
  diagramContent: string;
};

type SpecResponse = GeneratedSpec & { latencyMs?: number; specId?: string };

export function SpecPanel({ diagramId, diagramContent }: Props) {
  const [activeTab, setActiveTab] = useState<SpecTab>('prd');
  const [isLoading, setIsLoading] = useState(false);
  const [spec, setSpec] = useState<SpecResponse | null>(null);

  const handleGenerate = async () => {
    if (!diagramContent.trim()) {
      toast.error('The diagram is empty. Add some content before generating specs.');
      return;
    }

    setIsLoading(true);
    setSpec(null);

    try {
      const res = await fetch('/api/ai/generate-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagramId,
          content: diagramContent,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as SpecResponse;
      setSpec(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Spec generation failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const TABS: { value: SpecTab; label: string }[] = [
    { value: 'prd', label: 'PRD' },
    { value: 'stories', label: `Stories${spec ? ` (${spec.stories.length})` : ''}` },
    { value: 'edge-cases', label: `Edge Cases${spec ? ` (${spec.edgeCases.length})` : ''}` },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar: Generate button + Export button (when spec loaded) */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              Generating specs…
            </>
          ) : (
            'Generate Specs'
          )}
        </button>
        {spec?.specId && <ExportButton specId={spec.specId} />}
      </div>

      {/* Tabs */}
      {spec && (
        <div className="border-b px-3">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === t.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                aria-pressed={activeTab === t.value}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {spec ? (
          <>
            {activeTab === 'prd' && <PRDView prd={spec.prd} />}
            {activeTab === 'stories' && <StoriesList stories={spec.stories} />}
            {activeTab === 'edge-cases' && <EdgeCasesTable edgeCases={spec.edgeCases} />}
            {spec.latencyMs && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Generated in {(spec.latencyMs / 1000).toFixed(1)}s
              </p>
            )}
          </>
        ) : !isLoading ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Click Generate Specs to produce a PRD, user stories, and edge cases from your diagram.
          </p>
        ) : null}
      </div>
    </div>
  );
}
