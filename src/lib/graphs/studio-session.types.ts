import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { OnboardingPhase } from '@/lib/ai/prompts/onboarding';

/**
 * State threaded through the studio-session claudegraph run.
 */
export interface StudioSessionState {
  workspaceId: string;
  /** Full conversation history including user messages and AI assistant turns. */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Latest per-persona response text from multi-persona-respond node. */
  personaResponses: Record<string, string>;
  /** Current diagram in JsonGraph form (null until first generation). */
  currentDiagram: JsonGraph | null;
  /** Intent classified by parse-input node. */
  intent: 'describe' | 'refine' | 'confirm' | 'other' | null;
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
}

/**
 * Incremental diagram update produced by the `refine` LLMNode.
 * Applied on top of the current JsonGraph instead of a full regeneration.
 */
export interface DiagramPatch {
  addNodes?: { id: string; label: string; type?: string }[];
  removeNodes?: string[];
  addEdges?: { from: string; to: string; label?: string }[];
  removeEdges?: { from: string; to: string }[];
  modifyNodes?: { id: string; label?: string; type?: string }[];
}

/**
 * API response envelope for POST /api/studio/[workspaceId]/interact
 */
export type StudioInteractResponse =
  | { type: 'question'; content: string; runId: string; checkpoint: unknown }
  | { type: 'diagram'; mermaid: string; runId: string; checkpoint: unknown; patch?: DiagramPatch }
  | { type: 'complete'; diagramId: string }
  | { type: 'error'; message: string };
