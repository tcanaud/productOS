'use client';

import type { SpecEdgeCase } from '@/lib/ai/schemas/spec-output';

type Props = {
  edgeCases: SpecEdgeCase[];
};

type Severity = SpecEdgeCase['severity'];

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function EdgeCasesTable({ edgeCases }: Props) {
  if (edgeCases.length === 0) {
    return (
      <p className="mt-4 text-center text-xs text-muted-foreground">No edge cases identified.</p>
    );
  }

  const sorted = [...edgeCases].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <div className="flex flex-col gap-2 pt-3">
      {sorted.map((ec, i) => (
        <div key={i} className="rounded border p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[ec.severity]}`}
            >
              {ec.severity.charAt(0).toUpperCase() + ec.severity.slice(1)}
            </span>
            {ec.sourceNodes.length > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                → {ec.sourceNodes.join(', ')}
              </span>
            )}
          </div>
          <p className="text-xs leading-snug">{ec.description}</p>
        </div>
      ))}
    </div>
  );
}
