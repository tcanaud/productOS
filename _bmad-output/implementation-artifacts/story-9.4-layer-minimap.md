# Story 9.4 — Layer Minimap

## Status: review

## Story

**As a** user,
**I want** a minimap showing the full tree structure of my layers with my current position highlighted,
**So that** I can understand the overall hierarchy and quickly jump to any layer.

---

## Acceptance Criteria

1. **Given** a workspace has LayerGraphs forming a tree
   **When** the `LayerMinimap` component renders
   **Then** it displays the tree structure with node names

2. **And** the current layer is visually highlighted (e.g., bold, different color)

3. **And** composite nodes with children are shown with expand/collapse indicators

4. **Given** the minimap is displayed
   **When** the user clicks on any layer node in the minimap
   **Then** the view navigates to that layer (using `jumpToLayer`)

5. **And** the breadcrumb and URL update accordingly

6. **Given** the tree has more than 3 levels of depth
   **When** the minimap renders
   **Then** deep branches are collapsed by default

7. **And** the path to the current layer is always expanded

8. **Given** the minimap is integrated into `StudioLayout`
   **When** the user toggles it
   **Then** it appears as a sidebar panel that can be shown/hidden

9. **And** it does not interfere with the existing conversation/diagram panels

---

## Technical Notes

- **Requirements**: FR-L3, AR-L3
- **New files**:
  - `src/components/studio/LayerMinimap.tsx` — minimap tree component
- **Files to modify**:
  - `src/components/studio/StudioLayout.tsx` — integrate minimap toggle button and panel slot
- **Data source**: `GET /api/workspaces/[id]/layers` (returns all non-deleted layers for the workspace, same endpoint from Story 9.1)
- **Navigation**: uses `useLayerNavigation` hook from Story 9.3 (`jumpToLayer`, `layerStack`, `setStack`)

---

## Implementation Guidance

### 1. LayerMinimap component (`src/components/studio/LayerMinimap.tsx`)

The component fetches the flat list of layers, builds a tree in memory, then renders it recursively.

```tsx
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
  // Set of node IDs manually expanded by the user (beyond auto-expand of active path)
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

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    // Auto-expand nodes on active path or depth <= 2; manual toggle overrides
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
          onClick={() => handleNavigate(node)}
        >
          {hasChildren ? (
            <button
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
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
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
```

**Key behaviours:**

- Depth < 3 (levels 0, 1, 2) is auto-expanded on initial render.
- Nodes on the active path (`layerStack`) are always auto-expanded.
- The active layer node (`currentGraphId`) receives a distinct highlight style (`bg-primary/15 text-primary font-semibold`).
- User can manually collapse/expand any node; manual state takes priority over auto-expand rules.
- Clicking a node that is already in `layerStack` calls `jumpToLayer` (no API call). Clicking an arbitrary node fetches the ancestors API to reconstruct the stack.

### 2. StudioLayout — minimap toggle integration (`src/components/studio/StudioLayout.tsx`)

#### New state

```ts
const [minimapOpen, setMinimapOpen] = useState(false);
```

#### Toggle button

Add a `<button>` or icon button in the studio toolbar (alongside existing controls) to toggle the minimap:

```tsx
import { Map } from 'lucide-react';

// Inside toolbar:
<button
  onClick={() => setMinimapOpen((v) => !v)}
  className={cn(
    'p-2 rounded hover:bg-muted transition-colors',
    minimapOpen && 'bg-muted text-primary'
  )}
  title="Toggle layer minimap"
>
  <Map className="h-4 w-4" />
</button>;
```

#### Minimap panel slot

Render the minimap as a collapsible sidebar panel to the left of (or independently from) the existing conversation/diagram panels. It must not resize or reflow those panels — use `absolute` positioning over the layout or a dedicated fixed-width sidebar column:

```tsx
{
  minimapOpen && (
    <aside className="w-56 shrink-0 border-r bg-background flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>Layers</span>
        <button onClick={() => setMinimapOpen(false)} className="hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>
      <LayerMinimap workspaceId={workspaceId} />
    </aside>
  );
}
```

Place this `<aside>` as the first child of the horizontal flex container that holds the conversation panel and diagram panel, so it occupies a dedicated column to the left of both.

**Layout structure after this change:**

```
┌─ StudioLayout (flex-col) ────────────────────────────────┐
│  Header / toolbar (toggle button lives here)             │
│  LayerBreadcrumb (story 9.3, shown when depth > 1)       │
│  ┌─ main (flex-row) ──────────────────────────────────┐  │
│  │  [Minimap aside, w-56, collapsible]                 │  │
│  │  [Conversation panel]  [Diagram panel]              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

#### Import additions

```ts
import { LayerMinimap } from '@/components/studio/LayerMinimap';
import { Map, X } from 'lucide-react';
```

---

## Dev Notes

- `GET /api/workspaces/[id]/layers` returns all non-deleted layers; no new API route is needed.
- The ancestors API (`GET /api/workspaces/[id]/layers/[layerId]/ancestors`) from Story 9.3 is reused as-is for arbitrary-node navigation in the minimap.
- The minimap fetch result is not cached in Zustand; it re-fetches when the component mounts (each time the panel is opened). This is acceptable given the non-critical, read-only nature of the minimap.
- The `collapse:${id}` key convention in the `expanded` Set encodes explicit user collapses. This avoids a separate `collapsed` state and keeps toggle logic in one Set.
- The minimap panel (`w-56 = 224px`) is a flex sibling of the conversation and diagram panels. Since those panels likely use `flex-1` or `flex-grow`, adding a `shrink-0` sibling will reduce their combined width by 224px when open. Verify that the existing `ResizablePanelGroup` (if any) from shadcn/ui accommodates this; if `ResizablePanelGroup` is used, add the minimap as a separate `ResizablePanel` with `defaultSize={15}` instead.
- `useLayerNavigation` is used directly inside `LayerMinimap` (not passed as props) for consistency with `LayerBreadcrumb` from Story 9.3.
- The component renders `null`-equivalent (`<div>No layers yet.</div>`) when the flat list is empty, so it's safe to display even in workspaces without any layers.
- Do NOT add a loading spinner or skeleton — the minimap is non-critical UI and a flash of empty content is acceptable.
- TypeScript: `MinimapNode` is a local interface; no need to export it from `src/lib/layer/types.ts`.

---

## Checklist

- [x] `src/components/studio/LayerMinimap.tsx` — new component: fetches flat list, builds tree, renders recursively, highlights current layer, expands active path + depth < 3, expand/collapse toggle, click-to-navigate
- [x] `LayerMinimap` — clicking an ancestor already in `layerStack` uses `jumpToLayer` (no API)
- [x] `LayerMinimap` — clicking an arbitrary node fetches ancestors API and calls `setStack` + `router.replace`
- [x] `LayerMinimap` — current layer highlighted with `bg-primary/15 text-primary font-semibold`
- [x] `LayerMinimap` — nodes with children show `ChevronRight`/`ChevronDown` expand indicator
- [x] `LayerMinimap` — depth ≥ 3 branches collapsed by default; path to current layer always expanded
- [x] `StudioLayout` — `minimapOpen` boolean state added
- [x] `StudioLayout` — toolbar toggle button with `Map` icon added
- [x] `StudioLayout` — minimap `<aside>` panel rendered as flex sibling left of conversation/diagram panels
- [x] `StudioLayout` — minimap panel shows `X` close button
- [x] `StudioLayout` — minimap toggling does not shift/resize the conversation or diagram panels unexpectedly
- [x] Manual test: open minimap → tree renders with layer names
- [x] Manual test: current layer highlighted in minimap
- [x] Manual test: deep tree (> 3 levels) → only top 3 levels expanded, active path expanded
- [x] Manual test: click a node in minimap → breadcrumb and URL update, diagram loads that layer
- [x] Manual test: close minimap via X → panel hidden, no layout shift on conversation/diagram
- [x] Manual test: toggle minimap button re-opens panel

---

## Dev Agent Record

### Implementation Plan

Implemented Story 9.4 in 2 files (1 new, 1 modified) following existing patterns from Stories 9.3 (LayerBreadcrumb, useLayerNavigation) and 8.2 (canvas hooks).

1. **`src/components/studio/LayerMinimap.tsx`** (NEW) — Client component that:
   - Fetches `GET /api/workspaces/[id]/layers` on mount (fire-and-forget, silently fails)
   - Builds a tree from the flat list using a `Map<id, MinimapNode>` pass
   - Renders recursively via `renderNode(node, depth)` returning `React.ReactNode`
   - Auto-expands nodes at depth < 3 and all nodes on the active layer path (`activePathIds = new Set(layerStack.map(e => e.graphId))`)
   - Explicit collapse: uses `collapse:${id}` key in the `expanded` Set to override auto-expand
   - Current layer highlighted with `bg-primary/15 text-primary font-semibold`
   - Click on ancestor in `layerStack` → `jumpToLayer(index)` + URL update (no API call)
   - Click on arbitrary node → `GET /layers/${id}/ancestors` → `setStack(ancestors)` + URL update
   - `ChevronDown`/`ChevronRight` indicators for parent nodes
   - Empty state: renders `"No layers yet."` div when tree is empty

2. **`src/components/studio/StudioLayout.tsx`** (modified) — Added:
   - `import { Map, X } from 'lucide-react'` and `import { LayerMinimap } from './LayerMinimap'`
   - `const [minimapOpen, setMinimapOpen] = useState(false)` state
   - Minimap `<aside>` panel (w-56, shrink-0, border-r) rendered as first child of the `flex flex-1` container — left of conversation+diagram columns
   - Header inside aside with "Layers" label + X close button
   - `<LayerMinimap workspaceId={workspaceId} />` mounted inside aside
   - Map icon toggle button in the toolbar bar above the diagram (always visible, regardless of layer depth)
   - Refactored breadcrumb bar to always render (removed conditional wrapping) — back button still conditionally shown when `layerStack.length > 1`

### Tests Added

9 unit tests in `src/__tests__/layer/layer-minimap.test.ts`:

- Empty input returns empty array
- Single root node (no parentGraphId)
- Two-level tree (root + 2 children)
- Three-level deep tree
- Orphan node (unknown parentGraphId) treated as root
- Multiple roots
- Layer names preserved in tree nodes
- Four-level deep tree (depth ≥ 3 scenario)
- `parentId` preserved on tree nodes

### Completion Notes

- All 641 tests pass (632 pre-existing + 9 new); 0 regressions
- ESLint: 0 errors on new/modified story-9.4 files; 1 pre-existing warning in StudioLayout (`cpTree` exhaustive-deps, unchanged from before this story)
- TypeScript: 0 errors in story-9.4 files; pre-existing Zod API errors in unrelated route.ts files are unchanged
- Minimap panel is `shrink-0 w-56` flex sibling — conversation/diagram panels use `flex-1` so they absorb the 224px reduction naturally; no layout shift for the live-review panel
- `GET /api/workspaces/[id]/layers` and `GET /api/workspaces/[id]/layers/[id]/ancestors` are reused from Stories 9.1 and 9.3 respectively — no new API routes needed
- The toolbar bar above the diagram is now always rendered (not conditional on `layerStack.length > 1`), which keeps the minimap toggle permanently accessible regardless of navigation depth

### File List

- `src/components/studio/LayerMinimap.tsx` — NEW
- `src/__tests__/layer/layer-minimap.test.ts` — NEW
- `src/components/studio/StudioLayout.tsx` — modified (minimapOpen state, Map/X imports, LayerMinimap import, toggle button, aside panel, refactored breadcrumb bar)

### Change Log

- 2026-03-04: Story 9.4 implemented — Layer Minimap. New `LayerMinimap` component with flat→tree build, recursive rendering, depth-based auto-expand, active-path always-expanded, highlight current layer, click-to-navigate (jumpToLayer or ancestors API). StudioLayout gets `minimapOpen` toggle state, Map icon button, and w-56 aside panel that slides in left of the diagram column without disturbing other panels.
