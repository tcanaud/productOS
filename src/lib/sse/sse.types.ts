/**
 * SSE event types and payload interfaces for Studio Session streaming.
 * Story 6.6 — SSE/Streaming Communication
 */
import type { DiagramPatch } from '@/lib/graphs/studio-session.types';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { Cluster } from '@/lib/graphs/restructure-layers.types';

// ─────────────────────────────────────────────────────────────────────────────
// Event type union
// ─────────────────────────────────────────────────────────────────────────────

export type SSEEventType =
  | 'persona-message'
  | 'roundtable'
  | 'interaction'
  | 'diagram-update'
  | 'diagram-full'
  | 'review-annotation'
  | 'session-end'
  | 'restructure-progress';

// ─────────────────────────────────────────────────────────────────────────────
// Payload interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonaMessagePayload {
  persona: string;
  displayName: string;
  icon: string;
  message: string;
  emotion?: string;
  replyTo?: string;
}

export interface RoundtablePayload {
  questions: string[];
  suggestions: string[];
}

export interface InteractionPayload {
  question: string;
  inputType: 'text' | 'select' | 'multiselect';
  options?: string[];
}

export interface DiagramUpdatePayload {
  patch: DiagramPatch;
  /** AI-generated contextual summary of changes + micro-delta. */
  summary?: string;
}

export interface DiagramFullPayload {
  jsonGraph: JsonGraph;
  mermaidSyntax: string;
  /** AI-generated summary for initial diagram generation. */
  summary?: string;
}

export interface ReviewAnnotationPayload {
  nodeId: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface SessionEndPayload {
  summary: string;
}

// Story 11.1 / 11.2 — Restructure progress event
export type RestructureStep =
  | 'analyzing'
  | 'proposing'
  | 'negotiating'
  | 'applying'
  | 'checkpoint-created'
  | 'transaction-start'
  | 'cluster-applied'
  | 'validation-done'
  | 'done';

export interface RestructureProgressPayload {
  step: RestructureStep;
  /** Human-readable status message. */
  message: string;
  /** Current proposed clusters (present during negotiating/done steps). */
  clusters?: Cluster[];
  /** Analysis notes from LLM (present during proposing/negotiating steps). */
  analysisNotes?: string;
  /** Negotiation round number. */
  negotiationRound?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SSEEventMap: maps event type → payload
// ─────────────────────────────────────────────────────────────────────────────

export interface SSEEventMap {
  'persona-message': PersonaMessagePayload;
  roundtable: RoundtablePayload;
  interaction: InteractionPayload;
  'diagram-update': DiagramUpdatePayload;
  'diagram-full': DiagramFullPayload;
  'review-annotation': ReviewAnnotationPayload;
  'session-end': SessionEndPayload;
  'restructure-progress': RestructureProgressPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic SSEEvent wrapper
// ─────────────────────────────────────────────────────────────────────────────

export interface SSEEvent<T extends SSEEventType = SSEEventType> {
  id: string;
  type: T;
  data: SSEEventMap[T];
  timestamp: number;
}
