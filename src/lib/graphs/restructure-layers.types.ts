/**
 * restructure-layers.types.ts — Story 11.1
 *
 * Types for the Restructure Proposal and Negotiation claudegraph.
 */
import type { JsonGraph } from '@/lib/json2mermaid/types';

// ── Domain types ──────────────────────────────────────────────────────────────

export type RestructureMode = 'bottom-up' | 'top-down' | 'hybrid';

export interface SuggestedPort {
  name: string;
  direction: 'input' | 'output';
  /** The node in the adjacent cluster that this port connects to. */
  connectedNodeId: string;
}

export interface Cluster {
  id: string;
  /** Suggested composite node name. */
  name: string;
  /** IDs of original graph nodes grouped into this cluster. */
  nodeIds: string[];
  /** Ports inferred from cross-cluster edges. */
  suggestedPorts: SuggestedPort[];
}

// ── Graph state ───────────────────────────────────────────────────────────────

export interface RestructureState {
  workspaceId: string;
  /** Studio ID — used by the apply node to create a pre-restructure checkpoint. */
  studioId?: string;
  /** The flat (or existing hierarchical) graph to restructure. */
  graph: JsonGraph;
  /** Decomposition strategy: bottom-up, top-down, or hybrid. */
  mode: RestructureMode;
  /** Output language for messages (default: 'English'). */
  language: string;
  /** Text summary of analysis findings set by the `analyze` node. */
  analysisNotes?: string;
  /** Clusters proposed by the LLM. Updated on each negotiation round. */
  proposedClusters?: Cluster[];
  /** Latest user adjustment message (triggers a re-propose round). */
  userFeedback?: string;
  /** Number of negotiation rounds completed. Capped at 5. */
  negotiationRound: number;
  /** Set to true when the user validated the proposal. */
  finalClusters?: Cluster[];
  /** User requested a full re-think from scratch. */
  fromScratch?: boolean;
  /** Updated JsonGraph after `apply` node converts clusters to composite nodes. */
  updatedGraph?: JsonGraph;
  /** Error message if something went wrong. */
  error?: string;
  /** ID of the pre-restructure checkpoint created before apply. */
  checkpointId?: string;
  /** IDs of newly created child LayerGraphs after atomic apply. */
  appliedLayerIds?: string[];
  // Internal analysis fields (set by `analyze` FnNode)
  _nodeList?: { id: string; label: string; degree: number }[];
  _edgeList?: { from: string; to: string; label?: string }[];
  _leafNodeIds?: string[];
  _hubNodeIds?: string[];
}
