'use client';

/**
 * SSEConnectionBadge — Story 6.6: SSE/Streaming Communication
 *
 * Small status badge shown in the Studio header to indicate
 * the current SSE connection state.
 */
import { cn } from '@/lib/utils';
import type { ConnectionState } from '@/hooks/useStudioStream';

interface SSEConnectionBadgeProps {
  state: ConnectionState;
}

const STATE_CONFIG: Record<ConnectionState, { label: string; className: string }> = {
  connecting: { label: 'Connecting…', className: 'bg-yellow-100 text-yellow-700' },
  open: { label: 'Live', className: 'bg-green-100 text-green-700' },
  reconnecting: { label: 'Reconnecting…', className: 'bg-orange-100 text-orange-700' },
  failed: { label: 'Disconnected', className: 'bg-red-100 text-red-700' },
};

export function SSEConnectionBadge({ state }: SSEConnectionBadgeProps) {
  // Don't show badge when connected and live (keep UI clean)
  if (state === 'open') return null;

  const { label, className } = STATE_CONFIG[state];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
