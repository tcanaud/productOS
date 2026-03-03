# Quick Spec: Smart Live Review Panel

## Summary

Two intakes combined into a single implementation:

1. **Persistent Review Panel** — Dedicated panel in the studio with todo-list UX for live review annotations. Items persist in session, can be dismissed individually, sent to chat for discussion, or bulk-cleared via re-analyze.
2. **Smart Opus Prompt** — Upgrade live-review model from Haiku to Opus with a domain-aware, contextual prompt that produces 5-8 high-quality annotations.

## Changes

### 1. Session Types (`src/lib/session/types.ts`)
- Add `LiveReviewItem` interface extending `Annotation` with `id: string` and `dismissedAt?: string`
- Add `liveReviewItems?: LiveReviewItem[]` to `SessionArtifacts`

### 2. Live Review Graph (`src/lib/ai/graphs/live-review.graph.ts`)
- Change model from `haiku` to `claude-opus-4-6`
- Rewrite prompt for contextual/domain-level analysis:
  - Role: expert process modeler + systems architect
  - Input: nodes + edges + labels (full graph context)
  - Axes: structural integrity, semantic coherence, domain best practices, missing paths
  - Cap: 5-8 high-quality annotations, sorted by severity
  - Each annotation must include actionable `suggestions[]`
- Increase timeout to 180s (Opus is slower)

### 3. Live Review API Route (`src/app/api/ai/live-review/route.ts`)
- After `runLiveReview()`, persist annotations as `liveReviewItems` in session via `sessionManager.persistArtifacts()`
- Return `liveReviewItems` (with generated IDs) instead of raw `annotations`

### 4. New Component: `ReviewTaskPanel` (`src/components/studio/ReviewTaskPanel.tsx`)
- Panel with header: title + "Re-analyze" button
- List of `LiveReviewItem` cards:
  - Severity badge (color-coded)
  - Message + optional description
  - "Discuss" button (💬) → calls `onSendToChat(item)`
  - "Dismiss" button (✓) → calls `onDismiss(item.id)`
  - Slide-out animation on dismiss
- Empty state when all items dismissed: "All clear! Re-analyze when ready."
- Loading state during analysis (spinner + "Analyzing with Opus...")

### 5. Studio Layout (`src/components/studio/StudioLayout.tsx`)
- Replace auto-debounce live review with manual trigger (remove 2s timer)
- Add `liveReviewItems` state (loaded from session on hydrate)
- Add `ReviewTaskPanel` below the diagram panel (collapsible)
- Wire callbacks:
  - `onReanalyze()` → POST /api/ai/live-review → update items
  - `onDismiss(id)` → remove from local state + persist to session
  - `onSendToChat(item)` → inject contextualized message into chat input
- Keep badge overlay on diagram (fed from same `liveReviewItems` source)

## Out of Scope
- Chat-to-diagram action pipeline (Carson's vision — future iteration)
- Stale annotation detection (future iteration)
- Re-analyze from chat response (future iteration)
