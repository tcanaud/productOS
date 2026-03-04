'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useLayerNavigation } from '@/hooks/useLayerNavigation';

interface MinimapNode {
  id: string;
  name: string;
  parentId: string | null;
  children: MinimapNode[];
}

interface LayerMinimapProps {
  workspaceId: string;
}

export function LayerMinimap({ workspaceId }: LayerMinimapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { layerStack, jumpToLayer, setStack } = useLayerNavigation();
  const [tree, setTree] = useState<MinimapNode[]>([]);
  // Set of node IDs manually expanded/collapsed by the user
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const currentGraphId = layerStack.length > 0 ? layerStack[layerStack.length - 1].graphId : null;

  // IDs of nodes on the path to the current layer (always expanded)
  const activePathIds = new Set(layerStack.map((e) => e.graphId));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workspaces/${workspaceId}/layers`)
      .then((r) => r.json())
      .then((data: { id: string; name: string; parentGraphId: string | null }[]) => {
        if (cancelled) return;
        // Build tree from flat list
        const map = new Map<string, MinimapNode>();
        data.forEach((l) =>
          map.set(l.id, { id: l.id, name: l.name, parentId: l.parentGraphId, children: [] })
        );
        const roots: MinimapNode[] = [];
        map.forEach((node) => {
          if (node.parentId && map.has(node.parentId)) {
            map.get(node.parentId)!.children.push(node);
          } else {
            roots.push(node);
          }
        });
        setTree(roots);
      })
      .catch(() => {
        // Silently fail — minimap is non-critical UI
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleNavigate = useCallback(
    async (node: MinimapNode) => {
      if (currentGraphId === node.id) return;

      // Check if this node is already in the current layerStack
      const stackIndex = layerStack.findIndex((e) => e.graphId === node.id);
      if (stackIndex !== -1) {
        // Jump to an ancestor already in stack
        jumpToLayer(stackIndex);
        const params = new URLSearchParams(searchParams.toString());
        if (stackIndex === 0) {
          params.delete('layer');
        } else {
          params.set('layer', node.id);
        }
        router.replace(`?${params.toString()}`);
        return;
      }

      // Navigate to an arbitrary node — reconstruct stack via ancestors API
      const res = await fetch(`/api/workspaces/${workspaceId}/layers/${node.id}/ancestors`);
      if (!res.ok) return;
      const ancestors: { graphId: string; label: string }[] = await res.json();
      setStack(ancestors);
      const params = new URLSearchParams(searchParams.toString());
      params.set('layer', node.id);
      router.replace(`?${params.toString()}`);
    },
    [currentGraphId, jumpToLayer, layerStack, router, searchParams, setStack, workspaceId]
  );

  function renderNode(node: MinimapNode, depth: number): React.ReactNode {
    const isActive = node.id === currentGraphId;
    const isOnActivePath = activePathIds.has(node.id);
    const hasChildren = node.children.length > 0;
    // Auto-expand nodes on active path or depth < 3; explicit collapse:id key overrides
    const isExpanded =
      expanded.has(node.id) ||
      (!expanded.has(`collapse:${node.id}`) && (isOnActivePath || depth < 3));

    return (
      <li key={node.id} className="select-none">
        <div
          className={[
            'flex items-center gap-1 rounded px-2 py-1 text-sm cursor-pointer transition-colors',
            isActive
              ? 'bg-primary/15 text-primary font-semibold'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground',
          ].join(' ')}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => void handleNavigate(node)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                // Toggle: if currently auto-expanded (active path/shallow depth),
                // mark as explicitly collapsed; otherwise toggle expanded set.
                if (isExpanded && !expanded.has(node.id)) {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.add(`collapse:${node.id}`);
                    return next;
                  });
                } else {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.delete(`collapse:${node.id}`);
                    if (next.has(node.id)) {
                      next.delete(node.id);
                    } else {
                      next.add(node.id);
                    }
                    return next;
                  });
                }
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  }

  if (tree.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No layers yet.</div>;
  }

  return (
    <nav className="overflow-y-auto py-2">
      <ul>{tree.map((root) => renderNode(root, 0))}</ul>
    </nav>
  );
}
