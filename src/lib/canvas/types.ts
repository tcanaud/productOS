/**
 * Canvas types — Story 8.1
 *
 * Client-side TypeScript types for the spatial canvas data model.
 * These mirror the Prisma CanvasArtifact / CanvasConnection models
 * with position data flattened into a CanvasPosition sub-object for convenience.
 */

export type ArtifactType = 'diagram' | 'conversation' | 'review' | 'spec' | 'story' | 'note';

export interface CanvasPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasArtifact {
  id: string;
  workspaceId: string;
  type: ArtifactType;
  refId?: string | null;
  title?: string | null;
  zIndex: number;
  position: CanvasPosition;
}

export interface CanvasConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string | null;
}

export interface CanvasState {
  artifacts: CanvasArtifact[];
  connections: CanvasConnection[];
}
