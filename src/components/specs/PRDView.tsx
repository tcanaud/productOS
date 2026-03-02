'use client';

import type { PRD } from '@/lib/ai/schemas/spec-output';

type Props = {
  prd: PRD;
};

export function PRDView({ prd }: Props) {
  return (
    <div className="flex flex-col gap-4 pt-3">
      {/* Overview */}
      {prd.overview && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Overview
          </h3>
          <p className="text-xs leading-relaxed">{prd.overview}</p>
        </section>
      )}

      {/* Goals */}
      {prd.goals.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Goals
          </h3>
          <ul className="flex flex-col gap-1">
            {prd.goals.map((goal, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="mt-0.5 text-muted-foreground">•</span>
                <span>{goal}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Functional Requirements */}
      {prd.requirements.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Requirements ({prd.requirements.length})
          </h3>
          <div className="flex flex-col gap-2">
            {prd.requirements.map((req) => (
              <div key={req.id} className="rounded border p-2.5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
                    {req.id}
                  </span>
                  {req.sourceNodes.length > 0 && (
                    <span className="font-mono text-xs text-muted-foreground">
                      → {req.sourceNodes.join(', ')}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-snug">{req.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* NFRs */}
      {prd.nfrs.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Non-Functional Requirements ({prd.nfrs.length})
          </h3>
          <div className="flex flex-col gap-2">
            {prd.nfrs.map((nfr) => (
              <div key={nfr.id} className="rounded border p-2.5">
                <span className="mb-1 block rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium w-fit">
                  {nfr.id}
                </span>
                <p className="text-xs leading-snug">{nfr.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
