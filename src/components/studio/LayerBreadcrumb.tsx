'use client';

/**
 * LayerBreadcrumb — Story 9.3
 *
 * Displays the full layer navigation path (Root › Layer A › Current Layer).
 * Each ancestor segment is clickable and jumps to that layer.
 * Renders nothing when layerStack has 0 or 1 entries (at root / no navigation active).
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useLayerNavigation } from '@/hooks/useLayerNavigation';

export function LayerBreadcrumb() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { layerStack, jumpToLayer } = useLayerNavigation();

  if (layerStack.length <= 1) return null;

  const handleJump = (index: number) => {
    jumpToLayer(index);
    const entry = layerStack[index];
    const params = new URLSearchParams(searchParams.toString());
    if (index === 0) {
      params.delete('layer');
    } else {
      params.set('layer', entry.graphId);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?');
  };

  return (
    <nav
      className="flex items-center gap-1 text-sm text-muted-foreground px-4 py-2 border-b bg-background/50 backdrop-blur-sm"
      aria-label="Layer navigation"
      data-testid="layer-breadcrumb"
    >
      {layerStack.map((entry, i) => (
        <span key={entry.graphId} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight
              className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0"
              aria-hidden="true"
            />
          )}
          {i < layerStack.length - 1 ? (
            <button
              type="button"
              onClick={() => handleJump(i)}
              className="hover:text-foreground transition-colors underline-offset-2 hover:underline truncate max-w-[120px]"
              title={entry.label}
            >
              {entry.label}
            </button>
          ) : (
            <span
              className="text-foreground font-medium truncate max-w-[160px]"
              title={entry.label}
            >
              {entry.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
