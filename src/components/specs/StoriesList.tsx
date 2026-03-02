'use client';

import { useState } from 'react';
import type { UserStory } from '@/lib/ai/schemas/spec-output';

type Props = {
  stories: UserStory[];
};

export function StoriesList({ stories }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (stories.length === 0) {
    return (
      <p className="mt-4 text-center text-xs text-muted-foreground">No user stories generated.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-3">
      {stories.map((story) => {
        const isOpen = expanded.has(story.id);
        return (
          <div key={story.id} className="rounded border">
            <button
              onClick={() => toggle(story.id)}
              className="flex w-full items-start gap-2 p-3 text-left"
              aria-expanded={isOpen}
            >
              <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
                {story.id}
              </span>
              <span className="text-xs leading-snug">
                <span className="font-medium">As a</span> {story.role},{' '}
                <span className="font-medium">I want</span> {story.action},{' '}
                <span className="font-medium">so that</span> {story.benefit}
              </span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {isOpen ? '▲' : '▼'}
              </span>
            </button>

            {isOpen && story.acceptanceCriteria.length > 0 && (
              <div className="border-t px-3 pb-3">
                <p className="mb-2 pt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Acceptance Criteria
                </p>
                <div className="flex flex-col gap-2">
                  {story.acceptanceCriteria.map((ac, i) => (
                    <div key={i} className="rounded bg-muted/30 p-2 text-xs">
                      <p>
                        <span className="font-medium">Given</span> {ac.given}
                      </p>
                      <p>
                        <span className="font-medium">When</span> {ac.when}
                      </p>
                      <p>
                        <span className="font-medium">Then</span> {ac.then}
                      </p>
                      {ac.sourceNodes.length > 0 && (
                        <p className="mt-1 font-mono text-muted-foreground">
                          → {ac.sourceNodes.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
