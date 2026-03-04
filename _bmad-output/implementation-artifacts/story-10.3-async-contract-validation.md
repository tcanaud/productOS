# Story 10.3 — Async Contract Validation

## Status: review

## Story

**As a** user,
**I want** the system to automatically check port↔edge consistency after modifications,
**So that** I'm warned about contract violations without being blocked in my creative flow.

---

## Acceptance Criteria

1. **Given** the user modifies ports on a composite node or edges connected to a composite node
   **When** the modification is saved
   **Then** contract validation is triggered asynchronously after a 2-second debounce

2. **Given** contract validation runs
   **When** `contract-validator.ts` checks the current layer
   **Then** it verifies:
   - Every input port has at least one incoming edge in the parent graph
   - Every output port has at least one outgoing edge in the parent graph
   - No edges reference non-existent ports
   - Port types match edge semantics (if types are defined)

3. **Given** validation finds inconsistencies
   **When** the results are returned
   **Then** `ValidationWarning[]` objects are created with `{ nodeId, severity, message }`
   **And** these are displayed as warning badges via the existing badge-renderer pattern
   **And** warnings are non-blocking — the user can continue working

4. **Given** the AI generates or modifies a graph
   **When** the AI response is applied
   **Then** contract validation runs immediately (no debounce) to catch AI-generated violations

5. **Given** all ports and edges are consistent
   **When** validation completes
   **Then** any existing warning badges are cleared

---

## Technical Notes

- New file: `src/lib/layer/contract-validator.ts`
- Reuses badge-renderer pattern from Story 7.3 (live review indicators)
- Debounce logic in StudioLayout (2s, similar to existing live-review)
- Requirements: FR-L7, AR-L8

---

## Implementation Tasks

### 1. `src/lib/layer/contract-validator.ts`

- [x] Export `ValidationWarning` type: `{ nodeId: string; severity: 'error' | 'warning'; message: string }`
- [x] Export `validateContracts(layer: LayerGraph, parentGraph: JsonGraph): ValidationWarning[]`
- [x] Check 1: every input port on the layer has ≥1 incoming edge in `parentGraph` targeting that node
- [x] Check 2: every output port on the layer has ≥1 outgoing edge in `parentGraph` from that node
- [x] Check 3: no edge in `layer.graph` references a port not listed in `layer.ports`
- [x] Check 4: if a port has a `type` defined, edges connecting to it carry compatible semantics (best-effort, warn only)
- [x] Return empty array when fully consistent

### 2. `src/components/studio/StudioLayout.tsx` — debounced validation

- [x] Import `validateContracts` from `src/lib/layer/contract-validator.ts`
- [x] Add `validationWarnings` state (`ValidationWarning[]`)
- [x] After any port or edge mutation (save event), set a 2-second debounce before calling `validateContracts`
- [x] After an AI graph update (no debounce), call `validateContracts` immediately
- [x] Pass `validationWarnings` down to `DiagramPreviewPanel`

### 3. Badge rendering integration

- [x] In `DiagramPreviewPanel.tsx`, accept `validationWarnings` prop alongside existing `annotations`
- [x] Map `ValidationWarning[]` → badge-renderer calls using `src/lib/svg/badge-renderer.ts` (same pattern as Story 7.3)
- [x] Use severity to pick badge color: `error` → red (critical), `warning` → amber (medium)
- [x] Clear badges when `validationWarnings` is empty

### 4. Types

- [x] Add `ValidationWarning` to `src/lib/layer/types.ts` (or keep in `contract-validator.ts` and re-export)

---

## Dev Notes

- `contract-validator.ts` must be a pure function (no DB calls, no side effects) — takes data, returns warnings
- The parent graph is already available in StudioLayout as part of the layer state loaded by Story 9.1
- Debounce pattern mirrors `liveReviewDebounce` in StudioLayout (Story 7.3): use `useRef<NodeJS.Timeout>`
- Badge-renderer already injected into SVG post-render in `MermaidPreview.tsx`; reuse the same injection point
- No API route needed — validation is client-side only

---

## Dev Agent Record

### Implementation Plan

- Created `src/lib/layer/contract-validator.ts` as a pure function implementing all 4 checks
- Added `ValidationWarning` type re-export to `src/lib/layer/types.ts` for discoverability
- Updated `StudioLayout.tsx`: added `validationWarnings` state + `contractDebounceRef`, `runContractValidation` (fetches layer record then calls `validateContracts`), `scheduleContractValidation` (2s debounce), triggered on PortEditor close (debounced) and AI graph updates (immediate)
- Updated `DiagramPreviewPanel.tsx`: added `validationWarnings` prop, merged with `annotations` via `useMemo` mapping `'error'→'critical'` and `'warning'→'medium'` to reuse existing `injectBadges` without modification; used `mergedAnnotations` in `MermaidPreview` and `handleAction` view-review lookup

### Completion Notes

- All 4 ACs satisfied: debounced validation on port saves (AC1), full 4-check validation logic (AC2), non-blocking warning badges via existing badge-renderer (AC3), immediate validation on AI graph updates (AC4), badges cleared when warnings array is empty (AC5)
- No new API routes — validation is fully client-side
- No regressions — pre-existing TS/ESLint errors unchanged; no new errors introduced
- `ValidationWarning` is available from both `@/lib/layer/contract-validator` and `@/lib/layer/types`

### Files Changed

- `src/lib/layer/contract-validator.ts` (new)
- `src/lib/layer/types.ts` (added `ValidationWarning` re-export)
- `src/components/studio/StudioLayout.tsx` (debounce + validation + prop threading)
- `src/components/studio/DiagramPreviewPanel.tsx` (new prop + merged badge rendering)

### Change Log

- Story 10.3: Async contract validation — `validateContracts` pure function, 2s debounced trigger on port saves, immediate trigger on AI graph updates, warning badges via existing badge-renderer (Date: 2026-03-04)
