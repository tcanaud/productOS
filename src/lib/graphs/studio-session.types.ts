import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { OnboardingPhase } from '@/lib/ai/prompts/onboarding';
import type { PersonaMessage, Roundtable } from '@/lib/personas/parser';

/**
 * State threaded through the studio-session claudegraph run.
 */
export interface StudioSessionState {
  workspaceId: string;
  /** Story 6.7: absolute path to data/sessions/{workspaceId}/ for BMAD context. */
  sessionDir?: string;
  /** Full conversation history including user messages and AI assistant turns. */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Latest per-persona response text from multi-persona-respond node. */
  personaResponses: Record<string, string>;
  /** Current diagram in JsonGraph form (null until first generation). */
  currentDiagram: JsonGraph | null;
  /** Intent classified by parse-input node. */
  intent: 'describe' | 'refine' | 'confirm' | 'discuss' | 'other' | null;
  /**
   * Context richness score 0–100.
   * enough-context? routes to generate when score >= 60.
   */
  contextScore: number;
  /** Merged text response from all personas, set by multi-persona-respond. */
  mergedResponse?: string;
  /** Follow-up question to ask the user, set by multi-persona-respond. */
  followUpQuestion?: string;
  /** Latest diagram patch from refine node. */
  lastPatch?: DiagramPatch;
  /** AI-generated contextual summary of the last patch (from refine LLM). */
  lastPatchSummary?: string;
  /** Full history of patches applied in this session (for undo/debug). */
  patchHistory: DiagramPatch[];
  /** Persisted diagram ID, set by persist node. */
  persistedDiagramId?: string;
  /** Error message if something went wrong. */
  error?: string;
  // ── Story 6.3: Onboarding fields ──────────────────────────────────────────
  /** Word count of the first user message (computed once, immutable thereafter). */
  wordCount: number;
  /** Current onboarding phase driving adaptive clarification behaviour. */
  onboardingPhase: OnboardingPhase;
  /** Number of clarification questions asked so far. */
  clarificationCount: number;
  // ── Story 6.4: Party Mode fields ──────────────────────────────────────────
  /** Whether BMAD party mode is active (always true for Story 6.4 sessions). */
  partyModeEnabled: boolean;
  /** Last parsed persona messages from the party-mode response parser. */
  personaMessages: PersonaMessage[];
  /** Synthesized questions + suggested answers from the roundtable section. */
  roundtable?: Roundtable;
  // ── Story 10.1: Layer-awareness fields ────────────────────────────────────
  /** ID of the LayerGraph being edited (null = root studio diagram). */
  currentLayerId?: string | null;
  /** Layer navigation stack (mirrors client-side layerStack). */
  layerStack?: { graphId: string; label: string }[];
}

/**
 * Incremental diagram update produced by the `refine` LLMNode.
 * Applied on top of the current JsonGraph instead of a full regeneration.
 *
 * Patch application order: removeNodes → removeEdges → modifyNodes → addNodes → addEdges
 */
export interface DiagramPatch {
  addNodes?: { id: string; label: string; type?: string }[];
  removeNodes?: string[];
  addEdges?: { id?: string; from: string; to: string; label?: string }[];
  removeEdges?: string[];
  modifyNodes?: { id: string; label?: string; type?: string }[];
}

/**
 * Animation event emitted when a patch is applied to the diagram.
 * Used by DiagramPreviewPanel to animate added/removed/modified elements.
 */
export interface PatchAnimationEvent {
  type: 'add' | 'remove' | 'modify';
  nodeIds: string[];
  edgeIds: string[];
}

/**
 * API response envelope for POST /api/studio/[workspaceId]/interact
 */
export type StudioInteractResponse =
  | {
      type: 'question';
      content: string;
      runId: string;
      checkpoint: unknown;
      personas?: PersonaMessage[];
      roundtable?: Roundtable;
      studioId?: string;
    }
  | {
      type: 'diagram';
      mermaid: string;
      runId: string;
      checkpoint: unknown;
      patch?: DiagramPatch;
      patchAnimation?: PatchAnimationEvent;
      /** AI-generated summary of changes + micro-delta. */
      summary?: string;
      studioId?: string;
    }
  | { type: 'complete'; diagramId: string; studioId?: string }
  | { type: 'error'; message: string };
