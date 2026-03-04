# Story 9.3 — Layer Navigation with Breadcrumb

## Status: review

## Story

**As a** user,
**I want** to double-click a composite node to zoom into its child layer and navigate back via a breadcrumb,
**So that** I can explore the hierarchical structure of my graph intuitively.

---

## Acceptance Criteria

1. **Given** a composite node is displayed in the diagram
   **When** the user double-clicks on it
   **Then** the view transitions to the child LayerGraph (animated transition < 400ms, NFR-L1)

2. **And** the URL updates to include `?layer={childGraphId}`

3. **And** the Zustand layer navigation store is updated (`pushLayer`)

4. **Given** the user is navigated into a child layer
   **When** the `LayerBreadcrumb` component renders
   **Then** it displays the full path from root to current layer (e.g., "Root > Marketing > Campaign Flow")

5. **And** each breadcrumb segment is clickable to jump to that layer

6. **Given** the user clicks on a breadcrumb segment
   **When** the click is registered
   **Then** the view navigates to the selected layer (`jumpToLayer`)

7. **And** the `layerStack` is trimmed to match the new position

8. **And** the URL updates accordingly

9. **Given** the user is in a child layer
   **When** they click the back/pop action
   **Then** the view transitions back to the parent layer (`popLayer`)

10. **And** the URL updates to the parent layer ID

11. **Given** the page is loaded with `?layer=xyz` in the URL
    **When** the page initializes
    **Then** the Zustand store reconstructs the `layerStack` from the DB (walking `parentGraphId` chain)

12. **And** the correct layer is displayed

13. **Given** the "Zoom into layer" action is added to `DiagramContextMenu`
    **When** the user right-clicks a composite node and selects "Zoom into layer"
    **Then** it behaves identically to double-click navigation

---

## Technical Notes

- **Requirements**: FR-L3, NFR-L1, AR-L3
- **New files**:
  - `src/hooks/useLayerNavigation.ts` — Zustand store (layerStack, pushLayer, popLayer, jumpToLayer)
  - `src/components/studio/LayerBreadcrumb.tsx` — breadcrumb UI component
- **Files to modify**:
  - `src/components/studio/StudioLayout.tsx` — integrate breadcrumb + layer routing
  - `src/components/studio/DiagramPreviewPanel.tsx` — double-click composite → navigate
  - `src/components/studio/DiagramContextMenu.tsx` — add "Zoom into layer" action

---

## Implementation Guidance

### 1. Zustand store (`src/hooks/useLayerNavigation.ts`)

```ts
import { create } from 'zustand';

export interface LayerEntry {
  graphId: string;
  label: string; // layer name for breadcrumb display
}

interface LayerNavigationState {
  layerStack: LayerEntry[]; // index 0 = root
  pushLayer: (entry: LayerEntry) => void;
  popLayer: () => void;
  jumpToLayer: (index: number) => void;
  setStack: (stack: LayerEntry[]) => void;
  currentGraphId: () => string | null;
}

export const useLayerNavigation = create<LayerNavigationState>((set, get) => ({
  layerStack: [],
  pushLayer: (entry) => set((s) => ({ layerStack: [...s.layerStack, entry] })),
  popLayer: () => set((s) => ({ layerStack: s.layerStack.slice(0, -1) })),
  jumpToLayer: (index) => set((s) => ({ layerStack: s.layerStack.slice(0, index + 1) })),
  setStack: (stack) => set({ layerStack: stack }),
  currentGraphId: () => {
    const { layerStack } = get();
    return layerStack.length > 0 ? layerStack[layerStack.length - 1].graphId : null;
  },
}));
```

### 2. LayerBreadcrumb component (`src/components/studio/LayerBreadcrumb.tsx`)

- Reads `layerStack` from `useLayerNavigation`.
- Renders a horizontal breadcrumb: `Root > Layer A > Layer B`.
- Each segment (except the last) is a `<button>` calling `jumpToLayer(index)`.
- The last segment is plain text (current layer, non-clickable).
- On `jumpToLayer`, also update the URL query param `?layer={graphId}` using `router.replace`.
- If `layerStack` is empty or has only one entry (root), render nothing (or just "Root").

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
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
    router.replace(`?${params.toString()}`);
  };

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground px-4 py-2 border-b">
      {layerStack.map((entry, i) => (
        <span key={entry.graphId} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground/50">›</span>}
          {i < layerStack.length - 1 ? (
            <button
              onClick={() => handleJump(i)}
              className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              {entry.label}
            </button>
          ) : (
            <span className="text-foreground font-medium">{entry.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

### 3. DiagramContextMenu — "Zoom into layer" action (`src/components/studio/DiagramContextMenu.tsx`)

Add a new `DiagramAction` type:

```ts
| { type: 'zoom-into-layer'; nodeId: string; childGraphId: string }
```

In the node context menu, when the node is composite (has `childGraphId`), add:

```tsx
<ContextMenuItem onSelect={() => onAction({ type: 'zoom-into-layer', nodeId, childGraphId })}>
  Zoom into layer
</ContextMenuItem>
```

The `nodeId` and `childGraphId` are passed down from `DiagramPreviewPanel` via the existing context menu props (same pattern as Story 7.4).

### 4. DiagramPreviewPanel — double-click handler (`src/components/studio/DiagramPreviewPanel.tsx`)

- Add `onNavigateToLayer?: (childGraphId: string, nodeLabel: string) => void` prop.
- In the SVG post-processing / event-binding effect, attach a `dblclick` listener to each composite node element (identified by `[class*="composite"]` or by looking up `graph.nodes` for `type === "composite"`):

```ts
compositeNodes.forEach((node) => {
  const svgEl = resolveSvgNode(node.id); // mapSvgNodeId
  if (!svgEl) return;
  svgEl.addEventListener('dblclick', () => {
    if (node.childGraphId) {
      onNavigateToLayer?.(node.childGraphId, node.label ?? node.id);
    }
  });
});
```

- Handle `zoom-into-layer` DiagramAction in `handleAction`:

```ts
case 'zoom-into-layer':
  onNavigateToLayer?.(action.childGraphId, resolveNodeLabel(action.nodeId));
  break;
```

- Add a CSS transition class for the animated layer transition (opacity fade, < 400ms):

```css
.layer-transition-out {
  opacity: 0;
  transition: opacity 200ms ease-out;
}
.layer-transition-in {
  animation: layerFadeIn 300ms ease-in forwards;
}
@keyframes layerFadeIn {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### 5. StudioLayout — layer routing + URL sync (`src/components/studio/StudioLayout.tsx`)

#### URL initialization (reconstruct layerStack from DB)

On mount, read `searchParams.get('layer')`. If present:

1. Call `GET /api/workspaces/[workspaceId]/layers/[layerId]/ancestors` (see below) to get the ancestor chain.
2. Call `setStack(ancestors)` on the Zustand store.
3. Load the layer's `graph` JSON as the active diagram.

#### `handleNavigateToLayer`

```ts
const handleNavigateToLayer = useCallback(
  async (childGraphId: string, nodeLabel: string) => {
    // 1. Push to Zustand store
    pushLayer({ graphId: childGraphId, label: nodeLabel });
    // 2. Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('layer', childGraphId);
    router.replace(`?${params.toString()}`);
    // 3. Load child layer graph from API
    const res = await fetch(`/api/workspaces/${workspaceId}/layers/${childGraphId}`);
    const data = await res.json();
    setGraph(data.graph); // update claudegraph state
  },
  [pushLayer, router, searchParams, workspaceId, setGraph]
);
```

#### Breadcrumb placement

Render `<LayerBreadcrumb />` above the `<DiagramPreviewPanel />` inside the studio layout. Only visible when `layerStack.length > 1`.

#### Back/pop action

Wire a "Back" button (or keyboard shortcut) that calls `popLayer()` and updates the URL to the parent layer ID (or removes `?layer` if back at root).

### 6. Ancestors API endpoint

Add `GET /api/workspaces/[workspaceId]/layers/[layerId]/ancestors` to `src/app/api/workspaces/[workspaceId]/layers/[layerId]/ancestors/route.ts`:

- Walk `parentGraphId` chain via `layerService` until root.
- Return `[{ graphId, label }]` array from root to the given layer (inclusive).
- Use `layerService.getLayer(id)` in a loop; stop when `parentGraphId` is null.

```ts
// GET /api/workspaces/[workspaceId]/layers/[layerId]/ancestors
export async function GET(req, { params }) {
  const user = await requireAuth();
  const chain: LayerEntry[] = [];
  let currentId: string | null = params.layerId;
  while (currentId) {
    const layer = await layerService.getLayer(currentId, params.workspaceId, user.id);
    if (!layer) break;
    chain.unshift({ graphId: layer.id, label: layer.name });
    currentId = layer.parentGraphId ?? null;
  }
  return NextResponse.json(chain);
}
```

---

## Dev Notes

- The animated transition (< 400ms NFR-L1) is implemented via CSS `opacity + scale` keyframe on the diagram container. Apply `layer-transition-out` class, await 200ms, swap graph, then apply `layer-transition-in`.
- The `layerStack[0]` entry always represents the root layer. On the studio page, the root `graphId` should be the workspace's default/root layer graph. If none exists, `layerStack` starts empty and the breadcrumb is hidden.
- `popLayer` back to index 0 should remove the `?layer` query param entirely (root = no layer param).
- The `jumpToLayer(0)` call represents navigating back to root; URL param should be deleted in this case (not set to root ID).
- Double-click events on SVG nodes must use `pointer-events: all` on the target element; verify composite nodes have this CSS property set (it is set by `MermaidPreview.tsx` existing hover CSS injection).
- Use `router.replace` (not `push`) for layer navigation to avoid polluting browser history with every drill-down step. Only `pushLayer` in Zustand tracks the logical navigation stack.
- The ancestors API is only needed for page-load reconstruction. Normal navigation (push/pop/jump) is handled client-side by the Zustand store without additional API calls.
- `layerService.getLayer` must accept `workspaceId` + `userId` to enforce ownership; reuse the existing service method from Story 9.1.

---

## Checklist

- [x] `src/hooks/useLayerNavigation.ts` — Zustand store with `pushLayer`, `popLayer`, `jumpToLayer`, `setStack`
- [x] `src/components/studio/LayerBreadcrumb.tsx` — breadcrumb component rendering layerStack path
- [x] `DiagramContextMenu` — "Zoom into layer" action added for composite nodes
- [x] `DiagramPreviewPanel` — double-click on composite node calls `onNavigateToLayer`
- [x] `DiagramPreviewPanel` — handles `zoom-into-layer` DiagramAction
- [x] `DiagramPreviewPanel` — animated CSS transition applied on layer navigation (< 400ms)
- [x] `StudioLayout` — `handleNavigateToLayer` implemented (push store + URL + load graph)
- [x] `StudioLayout` — `LayerBreadcrumb` mounted above diagram panel
- [x] `StudioLayout` — URL `?layer=xyz` on page load reconstructs layerStack via ancestors API
- [x] `StudioLayout` — back/pop action clears URL param when returning to root
- [x] `GET /api/workspaces/[workspaceId]/layers/[layerId]/ancestors` route implemented
- [x] Manual test: double-click composite node → child layer loads with breadcrumb shown
- [x] Manual test: breadcrumb segment click → navigates to correct ancestor layer
- [x] Manual test: page reload with `?layer=xyz` → correct layer displayed, breadcrumb reconstructed
- [x] Manual test: right-click composite → "Zoom into layer" behaves identically to double-click

---

## Dev Agent Record

### Implementation Plan

Implemented Story 9.3 in 7 files following existing patterns from Stories 7.1/7.4 (context menu) and 8.2 (Zustand hooks).

1. **`src/hooks/useLayerNavigation.ts`** (NEW) — Zustand v5 store with `pushLayer`, `popLayer`, `jumpToLayer`, `setStack`, `currentGraphId`, `reset`. Compatible with Zustand v5 API (create from 'zustand').

2. **`src/components/studio/LayerBreadcrumb.tsx`** (NEW) — Client component reading `layerStack` from the Zustand store. Renders `Root › Layer A › Current Layer` nav with `ChevronRight` separators. Each ancestor is a clickable button that calls `jumpToLayer(index)` and updates `?layer=` URL param via `router.replace`. Renders nothing when `layerStack.length <= 1`. Uses `useRouter` + `useSearchParams` from next/navigation.

3. **`src/components/diagram/DiagramContextMenu.tsx`** (modified) — Added `zoom-into-layer` DiagramAction type. Added `childGraphId?: string` to `NodeMenuProps`. Added conditional "Zoom into layer" menu item (shown only when `childGraphId` is set), placed before other actions with a separator.

4. **`src/components/diagram/MermaidPreview.tsx`** (modified) — Added `onNodeDoubleClick?: (nodeId: string) => void` prop. Wired `dblclick` event listener on each `g.node` SVG element in the render effect. Added to dependency array.

5. **`src/components/studio/DiagramPreviewPanel.tsx`** (modified) — Added `onNavigateToLayer` prop. Added `navigateToLayer` callback (200ms fade-out via `isLayerTransitioning` state → calls `onNavigateToLayer`). Added `handleNodeDoubleClick` (detects composite node with `childGraphId`, calls `navigateToLayer`). Handles `zoom-into-layer` DiagramAction in `handleAction`. Passes `childGraphId` from graph to `DiagramContextMenu`. Passes `onNodeDoubleClick` to `MermaidPreview`. Applies `opacity: 0` transition during layer navigation.

6. **`src/components/studio/StudioLayout.tsx`** (modified) — Added `useRouter`, `useSearchParams`, `useLayerNavigation`, `LayerBreadcrumb` imports. On mount: reads `?layer=xyz` param, calls ancestors API to reconstruct `layerStack`, loads child layer graph. Added `handleNavigateToLayer` callback (pushLayer + URL update + load layer graph). Added `handlePopLayer` callback (popLayer + URL update + load parent graph). Renders `LayerBreadcrumb` + "← Back" button above `DiagramPreviewPanel` when `layerStack.length > 1`. Passes `onNavigateToLayer={handleNavigateToLayer}` to `DiagramPreviewPanel`.

7. **`src/app/api/workspaces/[id]/layers/[layerId]/ancestors/route.ts`** (NEW) — `GET` handler that walks the `parentGraphId` chain from the target layer up to root using `getLayer()` from `layer-service`. Returns `LayerEntry[]` ordered `[root, ..., targetLayer]`. Enforces workspace membership check identical to existing layer routes.

### Tests Added

14 unit tests in `src/__tests__/layer/layer-navigation.test.ts`:

- Empty stack initial state
- `currentGraphId()` returns null on empty stack
- `pushLayer` adds entry
- Multiple `pushLayer` calls stack in order
- `currentGraphId()` returns last entry
- `popLayer` removes last entry
- `popLayer` on single entry → empty stack
- `popLayer` on empty stack → no crash
- `jumpToLayer` trims to index inclusive
- `jumpToLayer(0)` keeps only root
- `setStack` replaces entire stack
- `setStack([])` clears stack
- `reset` clears stack
- `currentGraphId` updates correctly after push+pop

### Completion Notes

- All 632 tests pass (618 pre-existing + 14 new); 0 regressions
- ESLint: 0 errors, 0 new warnings on all modified/new files (pre-existing `cpTree` warning in StudioLayout is unchanged from before this story)
- TypeScript: 0 errors in story-9.3 files (pre-existing Zod API errors in unrelated route.ts files are unchanged)
- Animated transition: implemented as `opacity 200ms ease-out` via inline style on diagram container (`isLayerTransitioning` state), satisfying NFR-L1 (< 400ms total)
- `router.replace` used (not push) to avoid polluting browser history; Zustand store tracks logical navigation stack
- Ancestors API guards against non-existent layers (404) and enforces workspace ownership
- `onNavigateToLayer` is optional on `DiagramPreviewPanel` (backwards compatible)

### File List

- `src/hooks/useLayerNavigation.ts` — NEW
- `src/components/studio/LayerBreadcrumb.tsx` — NEW
- `src/app/api/workspaces/[id]/layers/[layerId]/ancestors/route.ts` — NEW
- `src/__tests__/layer/layer-navigation.test.ts` — NEW
- `src/components/diagram/DiagramContextMenu.tsx` — modified (zoom-into-layer action + childGraphId prop)
- `src/components/diagram/MermaidPreview.tsx` — modified (onNodeDoubleClick prop + dblclick handler)
- `src/components/studio/DiagramPreviewPanel.tsx` — modified (navigateToLayer, handleNodeDoubleClick, zoom-into-layer action handling, layer transition animation)
- `src/components/studio/StudioLayout.tsx` — modified (layer navigation hooks, URL sync, breadcrumb + back button, handleNavigateToLayer, handlePopLayer)

### Change Log

- 2026-03-04: Story 9.3 implemented — Layer Navigation with Breadcrumb. Zustand `useLayerNavigation` store, `LayerBreadcrumb` component, double-click and context-menu composite node navigation, URL ?layer= sync, page-load stack reconstruction from ancestors API, back/pop action.
