'use client';

import { useState } from 'react';

type Severity = 'critical' | 'high' | 'medium' | 'low';

type Props = {
  description: string;
  severity?: Severity;
  targetNode?: string;
  affectedNodes?: string[];
  type: 'edge-case' | 'risk' | 'inconsistency' | 'suggestion';
  extra?: string; // e.g. "likelihood: high / impact: high"
};

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const TYPE_LABEL: Record<Props['type'], string> = {
  'edge-case': 'Edge Case',
  risk: 'Risk',
  inconsistency: 'Inconsistency',
  suggestion: 'Suggestion',
};

export function ReviewCard({
  description,
  severity,
  targetNode,
  affectedNodes,
  type,
  extra,
}: Props) {
  const [addressed, setAddressed] = useState(false);

  const severityStyle = severity
    ? SEVERITY_STYLES[severity]
    : 'bg-muted text-muted-foreground border-border';
  const nodes = targetNode
    ? [targetNode]
    : affectedNodes && affectedNodes.length > 0
      ? affectedNodes
      : [];

  return (
    <div
      className={`rounded border p-3 text-sm transition-opacity ${addressed ? 'opacity-40' : ''}`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium border ${severityStyle}`}>
          {severity ? severity.charAt(0).toUpperCase() + severity.slice(1) : TYPE_LABEL[type]}
        </span>
        {nodes.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground">→ {nodes.join(', ')}</span>
        )}
      </div>

      <p className="leading-snug text-foreground">{description}</p>

      {extra && <p className="mt-1 text-xs text-muted-foreground">{extra}</p>}

      <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={addressed}
          onChange={(e) => setAddressed(e.target.checked)}
          className="accent-primary"
        />
        Mark as addressed
      </label>
    </div>
  );
}
