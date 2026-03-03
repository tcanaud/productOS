/**
 * SSE event types and payload interfaces for Studio Session streaming.
 * Story 6.6 — SSE/Streaming Communication
 */
import type { DiagramPatch } from '@/lib/graphs/studio-session.types';
import type { JsonGraph } from '@/lib/json2mermaid/types';

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
  | 'session-end';

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
}

export interface DiagramFullPayload {
  jsonGraph: JsonGraph;
  mermaidSyntax: string;
}

export interface ReviewAnnotationPayload {
  nodeId: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface SessionEndPayload {
  summary: string;
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
