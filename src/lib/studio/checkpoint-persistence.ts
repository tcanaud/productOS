import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

export interface CreateCheckpointData {
  parentId: string | null;
  branchName: string;
  turnNumber: number;
  checkpoint: unknown;
  graphState: unknown;
  messageHistory?: unknown[];
  userMessage: string;
  mermaidPreview?: string | null;
}

export interface CheckpointNode {
  id: string;
  parentId: string | null;
  branchName: string;
  turnNumber: number;
  userMessage: string;
  mermaidPreview: string | null;
  createdAt: string;
}

export interface CheckpointFull {
  id: string;
  parentId: string | null;
  branchName: string;
  turnNumber: number;
  checkpoint: unknown;
  graphState: unknown;
  messageHistory: unknown[] | null;
  userMessage: string;
  mermaidPreview: string | null;
  createdAt: string;
}

export const checkpointPersistence = {
  /**
   * Create a new checkpoint node in the tree.
   * Handles implicit branching: if the parent already has children on the
   * same branch, auto-generates a new branch name.
   */
  async createCheckpoint(
    studioId: string,
    data: CreateCheckpointData
  ): Promise<{ id: string; branchName: string; turnNumber: number }> {
    let { branchName } = data;

    // Implicit branching: check if parent already has children on this branch
    if (data.parentId) {
      const existingChildren = await prisma.studioCheckpoint.findMany({
        where: { parentId: data.parentId },
        select: { branchName: true },
      });

      if (existingChildren.some((c) => c.branchName === branchName)) {
        // Parent already has a child on this branch — generate new branch name
        const allBranches = await prisma.studioCheckpoint.findMany({
          where: { studioId },
          select: { branchName: true },
          distinct: ['branchName'],
        });
        const branchNames = new Set(allBranches.map((b) => b.branchName));
        let counter = 1;
        while (branchNames.has(`branch-${counter}`)) {
          counter++;
        }
        branchName = `branch-${counter}`;
      }
    }

    const row = await prisma.studioCheckpoint.create({
      data: {
        studioId,
        parentId: data.parentId,
        branchName,
        turnNumber: data.turnNumber,
        checkpoint: data.checkpoint as Prisma.InputJsonValue,
        graphState: data.graphState as Prisma.InputJsonValue,
        messageHistory: data.messageHistory
          ? (data.messageHistory as unknown as Prisma.InputJsonValue)
          : undefined,
        userMessage: data.userMessage,
        mermaidPreview: data.mermaidPreview ?? null,
      },
    });

    return { id: row.id, branchName: row.branchName, turnNumber: row.turnNumber };
  },

  /**
   * Return lightweight checkpoint tree for a studio (no full blobs).
   */
  async getTree(studioId: string): Promise<CheckpointNode[]> {
    const rows = await prisma.studioCheckpoint.findMany({
      where: { studioId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        parentId: true,
        branchName: true,
        turnNumber: true,
        userMessage: true,
        mermaidPreview: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      branchName: r.branchName,
      turnNumber: r.turnNumber,
      userMessage: r.userMessage,
      mermaidPreview: r.mermaidPreview,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  /**
   * Load a single checkpoint with full data.
   */
  async getCheckpoint(checkpointId: string): Promise<CheckpointFull | null> {
    const row = await prisma.studioCheckpoint.findUnique({
      where: { id: checkpointId },
    });
    if (!row) return null;

    return {
      id: row.id,
      parentId: row.parentId,
      branchName: row.branchName,
      turnNumber: row.turnNumber,
      checkpoint: row.checkpoint,
      graphState: row.graphState,
      messageHistory: row.messageHistory as unknown[] | null,
      userMessage: row.userMessage,
      mermaidPreview: row.mermaidPreview,
      createdAt: row.createdAt.toISOString(),
    };
  },

  /**
   * Update the Studio's head pointer and active branch.
   */
  async updateHead(studioId: string, checkpointId: string, branchName: string): Promise<void> {
    await prisma.studio.update({
      where: { id: studioId },
      data: { headCheckpointId: checkpointId, activeBranchName: branchName },
    });
  },

  /**
   * Fork a new Studio from a checkpoint.
   * Copies graphState, checkpoint, messageHistory; creates initial root checkpoint.
   */
  async forkStudio(
    workspaceId: string,
    sourceCheckpointId: string,
    newTitle: string
  ): Promise<{ studioId: string; checkpointId: string }> {
    const source = await prisma.studioCheckpoint.findUnique({
      where: { id: sourceCheckpointId },
    });
    if (!source) throw new Error('Source checkpoint not found');

    // Create new Studio
    const studio = await prisma.studio.create({
      data: {
        workspaceId,
        title: newTitle,
        graphState: source.graphState as Prisma.InputJsonValue,
        checkpoint: source.checkpoint as Prisma.InputJsonValue,
        messageHistory: source.messageHistory as Prisma.InputJsonValue | undefined,
        activeBranchName: 'main',
      },
    });

    // Create root checkpoint for the new studio
    const rootCp = await prisma.studioCheckpoint.create({
      data: {
        studioId: studio.id,
        parentId: null,
        branchName: 'main',
        turnNumber: 0,
        checkpoint: source.checkpoint as Prisma.InputJsonValue,
        graphState: source.graphState as Prisma.InputJsonValue,
        messageHistory: source.messageHistory as Prisma.InputJsonValue | undefined,
        userMessage: `Forked from checkpoint`,
        mermaidPreview: source.mermaidPreview,
      },
    });

    // Update head pointer
    await prisma.studio.update({
      where: { id: studio.id },
      data: { headCheckpointId: rootCp.id },
    });

    // Create CanvasArtifact for the new studio
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
        title: newTitle,
        x: 40,
        y: newY,
        width: 400,
        height: 240,
        zIndex: 0,
      },
    });

    return { studioId: studio.id, checkpointId: rootCp.id };
  },
};
