'use client';

import { MarkdownContent } from './MarkdownContent';

interface PersonaMessageBubbleProps {
  displayName: string;
  icon: string;
  color: string;
  content: string;
  /** Delay in ms before the fade-in animation starts (for staggered entrance). */
  animationDelay?: number;
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
}: PersonaMessageBubbleProps) {
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
        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold"
        style={{ color, backgroundColor: `${color}14` }}
      >
        <span aria-hidden="true">{icon}</span>
        <span>{displayName}</span>
      </div>

      {/* Body */}
      <div
        className="px-3 py-2 text-sm text-foreground border-l-4 bg-muted/40"
        style={{ borderLeftColor: color }}
      >
        <MarkdownContent content={content} />
      </div>
    </div>
  );
}
