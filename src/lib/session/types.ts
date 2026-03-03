/**
 * Session types for Story 6.7 — BMAD Session Isolation (Per Workspace)
 */

import type { BmadConfig } from './config-reader';
import type { Annotation } from '@/lib/ai/graphs/live-review.graph';

/**
 * A live-review annotation enriched with a stable ID and optional dismiss timestamp.
 * Persisted in the session so annotations survive across renders and page reloads.
 */
export interface LiveReviewItem extends Annotation {
  /** Stable unique ID for dismiss/send-to-chat tracking. */
  id: string;
  /** ISO timestamp when the user dismissed this item (undefined = still active). */
  dismissedAt?: string;
}

/**
 * Context loaded from a workspace's BMAD memory files.
 * Passed to AI team nodes so they retain project context across sessions.
 */
export interface SessionContext {
  workspaceId: string;
  /** Absolute filesystem path to the session directory. */
  sessionDir: string;
  /** Content of _bmad/memory/MEMORY.md (empty string if not yet created). */
  memory: string;
  /** Content of _bmad/memory/decisions.md (empty string if not yet created). */
  decisions: string;
  /** Whether this is a brand-new session (no prior BMAD files existed). */
  isNew: boolean;
  /** Parsed BMAD core config (communication_language, document_output_language, etc.). */
  bmadConfig: BmadConfig;
}

/**
 * Artifacts produced during a studio session to be persisted at session end.
 */
export interface SessionArtifacts {
  /** Serialised JsonGraph of the final diagram (stringified JSON). */
  diagramJson?: string;
  /** Mermaid syntax of the final diagram. */
  diagramMermaid?: string;
  /** Optional version tag / label for the artifact set. */
  version?: string;
  /** Review annotations keyed by nodeId. */
  reviews?: Record<string, { severity: 'info' | 'warning' | 'error'; message: string }[]>;
  /** Updated BMAD memory content to write back to _bmad/memory/MEMORY.md. */
  updatedMemory?: string;
  /** Updated decisions log to write back to _bmad/memory/decisions.md. */
  updatedDecisions?: string;
  /** Live review items persisted for the todo-list panel. */
  liveReviewItems?: LiveReviewItem[];
  /** Studio ID to scope live review items to a specific studio. */
  studioId?: string;
  /** Arbitrary state blob to persist in the WorkspaceSession DB record. */
  state?: Record<string, unknown>;
}
