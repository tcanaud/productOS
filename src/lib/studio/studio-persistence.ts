import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { StudioSessionState } from '@/lib/graphs/studio-session.types';
import type { RunCheckpoint } from 'claudegraph';

export interface StudioRecord {
  id: string;
  title: string;
  status: string;
  graphState: StudioSessionState | null;
  checkpoint: RunCheckpoint | null;
  messageHistory: unknown[] | null;
  diagramId: string | null;
  sseSessionId: string | null;
}

export interface StudioSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

export interface SaveTurnData {
  graphState: StudioSessionState;
  checkpoint: unknown;
  messageHistory?: unknown[];
  sseSessionId?: string;
  title?: string;
}

export const studioPersistence = {
  /**
   * Create a new Studio in DB + a CanvasArtifact of type 'studio'.
   * Returns the new studio ID.
   */
  async create(workspaceId: string, title: string): Promise<string> {
    const studio = await prisma.studio.create({
      data: {
        workspaceId,
        title,
      },
    });

    // Create a CanvasArtifact for this studio
    const last = await prisma.canvasArtifact.findFirst({
      where: { workspaceId },
      orderBy: { y: 'desc' },
      select: { y: true, height: true },
    });
    const newY = last ? last.y + last.height + 40 : 40;

    await prisma.canvasArtifact.create({
      data: {
        workspaceId,
        type: 'studio',
        refId: studio.id,
        title,
        x: 40,
        y: newY,
        width: 400,
        height: 240,
        zIndex: 0,
      },
    });

    return studio.id;
  },

  /**
   * Load full studio state from DB.
   */
  async load(studioId: string): Promise<StudioRecord | null> {
    const row = await prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      graphState: row.graphState as StudioSessionState | null,
      checkpoint: row.checkpoint as RunCheckpoint | null,
      messageHistory: row.messageHistory as unknown[] | null,
      diagramId: row.diagramId,
      sseSessionId: row.sseSessionId,
    };
  },

  /**
   * Save a turn's state: graphState, checkpoint, messageHistory, sseSessionId, title.
   */
  async saveTurn(studioId: string, data: SaveTurnData): Promise<void> {
    await prisma.studio.update({
      where: { id: studioId },
      data: {
        graphState: data.graphState as unknown as Prisma.InputJsonValue,
        checkpoint: data.checkpoint as unknown as Prisma.InputJsonValue,
        ...(data.messageHistory ? { messageHistory: data.messageHistory as unknown as Prisma.InputJsonValue } : {}),
        ...(data.sseSessionId ? { sseSessionId: data.sseSessionId } : {}),
        ...(data.title ? { title: data.title } : {}),
      },
    });

    // Update matching CanvasArtifact title if changed
    if (data.title) {
      await prisma.canvasArtifact.updateMany({
        where: { type: 'studio', refId: studioId },
        data: { title: data.title },
      });
    }
  },

  /**
   * Save messageHistory separately (called by the client after SSE events settle).
   */
  async saveMessages(studioId: string, messageHistory: unknown[]): Promise<void> {
    await prisma.studio.update({
      where: { id: studioId },
      data: {
        messageHistory: messageHistory as unknown as Prisma.InputJsonValue,
      },
    });
  },

  /**
   * Mark studio as completed and link diagram.
   */
  async complete(studioId: string, diagramId: string): Promise<void> {
    await prisma.studio.update({
      where: { id: studioId },
      data: { status: 'completed', diagramId },
    });
  },

  /**
   * List studios for a workspace, sorted by updatedAt desc.
   */
  async list(workspaceId: string): Promise<StudioSummary[]> {
    const rows = await prisma.studio.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, status: true, updatedAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
    }));
  },
};
