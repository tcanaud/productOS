import type { PrismaClient } from '@/generated/prisma/client';
import { SOFT_LIMITS } from './types';

/**
 * Returns true if making `parentId` the parent of `candidateId` would create
 * a cycle in the LayerTree. Walks the ancestor chain from `parentId` upward,
 * limited to SOFT_LIMITS.depth hops.
 */
export async function wouldCreateCycle(
  prisma: PrismaClient,
  parentId: string,
  candidateId: string
): Promise<boolean> {
  let currentId: string | null = parentId;
  let iterations = 0;

  while (currentId !== null && iterations < SOFT_LIMITS.depth) {
    if (currentId === candidateId) return true;

    const row: { parentGraphId: string | null } | null = await prisma.layerGraph.findUnique({
      where: { id: currentId },
      select: { parentGraphId: true },
    });

    currentId = row?.parentGraphId ?? null;
    iterations++;
  }

  // Final check after depth cap
  if (currentId === candidateId) return true;

  return false;
}
