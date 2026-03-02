'use client';

import { useState } from 'react';
import { toast } from 'sonner';

type DiagramType = 'flowchart' | 'stateDiagram' | 'sequenceDiagram';

type Props = {
  onGenerated: (mermaidSyntax: string) => void;
  hasExistingContent: boolean;
};

const DIAGRAM_TYPES: { value: DiagramType; label: string }[] = [
  { value: 'flowchart', label: 'Flowchart' },
  { value: 'stateDiagram', label: 'State Diagram' },
  { value: 'sequenceDiagram', label: 'Sequence Diagram' },
];

export function AIGeneratePanel({ onGenerated, hasExistingContent }: Props) {
  const [description, setDescription] = useState('');
  const [diagramType, setDiagramType] = useState<DiagramType>('flowchart');
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState('');

  const handleGenerate = async () => {
    if (description.trim().length < 10) {
      toast.error('Please enter at least 10 characters describing your flow.');
      return;
    }

    if (hasExistingContent) {
      const confirmed = window.confirm('This will replace your current diagram content. Continue?');
      if (!confirmed) return;
    }

    setIsLoading(true);
    setExplanation('');

    try {
      const res = await fetch('/api/ai/generate-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), diagramType }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as {
        mermaidSyntax: string;
        explanation: string;
      };

      onGenerated(data.mermaidSyntax);
      setExplanation(data.explanation);
      toast.success('Diagram generated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Generate with AI</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ai-diagram-type" className="text-xs text-muted-foreground">
          Diagram type
        </label>
        <select
          id="ai-diagram-type"
          value={diagramType}
          onChange={(e) => setDiagramType(e.target.value as DiagramType)}
          disabled={isLoading}
          className="rounded border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          {DIAGRAM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="ai-description" className="text-xs text-muted-foreground">
          Description
        </label>
        <textarea
          id="ai-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          placeholder="Describe your flow in plain English…"
          className="min-h-[120px] flex-1 resize-none rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          maxLength={2000}
        />
        <span className="self-end text-xs text-muted-foreground">{description.length}/2000</span>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isLoading || description.trim().length < 10}
        className="flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Generating…
          </>
        ) : (
          'Generate'
        )}
      </button>

      {explanation && (
        <div className="rounded border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">AI Explanation</p>
          <p className="text-xs leading-relaxed text-foreground">{explanation}</p>
        </div>
      )}
    </div>
  );
}
