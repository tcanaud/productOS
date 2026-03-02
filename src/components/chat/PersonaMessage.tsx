'use client';

import { ActionableSuggestion } from './ActionableSuggestion';
import type { PersonaResponse } from '@/lib/ai/schemas/chat-response';

// Persona visual config (matches personas.ts definitions)
const PERSONA_CONFIG: Record<string, { icon: string; color: string }> = {
  PM_OPTIMIST: { icon: '🚀', color: '#16a34a' },
  ARCHITECT_PRAGMATIST: { icon: '🏗️', color: '#2563eb' },
  ANALYST: { icon: '🔍', color: '#7c3aed' },
  CRITIC: { icon: '⚠️', color: '#dc2626' },
};

const DEFAULT_CONFIG = { icon: '🤖', color: '#6b7280' };

type Props = {
  response: PersonaResponse;
};

export function PersonaMessage({ response }: Props) {
  const config = PERSONA_CONFIG[response.personaId] ?? DEFAULT_CONFIG;

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm"
        style={{ backgroundColor: `${config.color}20`, border: `1.5px solid ${config.color}` }}
        aria-hidden="true"
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        {/* Name badge */}
        <span className="text-xs font-semibold" style={{ color: config.color }}>
          {response.name}
        </span>

        {/* Message */}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {response.message}
        </p>

        {/* Actionable suggestions */}
        {response.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {response.suggestions.map((s) => (
              <ActionableSuggestion key={s.id} suggestion={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
