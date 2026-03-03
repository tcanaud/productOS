'use client';

import { EMOTION_META } from '@/lib/personas/parser';
import type { PersonaEmotion } from '@/lib/personas/parser';
import { MarkdownContent } from './MarkdownContent';

interface PersonaMessageBubbleProps {
  displayName: string;
  icon: string;
  color: string;
  content: string;
  /** Delay in ms before the fade-in animation starts (for staggered entrance). */
  animationDelay?: number;
  /** Emotion key from the persona's response. */
  emotion?: string;
  /** Display name of the persona this message replies to. */
  replyToName?: string;
}

/**
 * Styled message bubble for a single persona response in BMAD Party Mode.
 *
 * Design:
 * ┌──────────────────────────────────┐
 * │ 📋 Product Strategist             │  ← colored header (icon + display name)
 * ├──────────────────────────────────┤
 * │ Here's how I'd frame the         │
 * │ strategic priorities...          │  ← body with left border in persona color
 * └──────────────────────────────────┘
 */
export function PersonaMessageBubble({
  displayName,
  icon,
  color,
  content,
  animationDelay = 0,
  emotion,
  replyToName,
}: PersonaMessageBubbleProps) {
  const emotionMeta = emotion && emotion in EMOTION_META
    ? EMOTION_META[emotion as PersonaEmotion]
    : undefined;

  return (
    <div
      className="rounded-lg overflow-hidden border border-border animate-in fade-in"
      style={{
        animationDelay: `${animationDelay}ms`,
        animationFillMode: 'both',
        animationDuration: '200ms',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold"
        style={{ color, backgroundColor: `${color}14` }}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{icon}</span>
          <span>{displayName}</span>
        </div>
        {emotionMeta && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${color}1A`, color }}
          >
            <span aria-hidden="true">{emotionMeta.emoji}</span>
            <span>{emotionMeta.label}</span>
          </span>
        )}
      </div>

      {/* Body */}
      <div
        className="px-3 py-2 text-sm text-foreground border-l-4 bg-muted/40"
        style={{ borderLeftColor: color }}
      >
        {replyToName && (
          <p className="mb-1 text-xs italic text-muted-foreground">
            ↩ En réponse à {replyToName}
          </p>
        )}
        <MarkdownContent content={content} />
      </div>
    </div>
  );
}
