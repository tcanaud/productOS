/**
 * migrateV1ToCanvas — Story 8.1
 *
 * Idempotent helper that seeds CanvasArtifact rows for a workspace
 * based on the V1 split-view layout:
 *
 *   conversation panel: x=40,  y=40, width=480, height=640
 *   diagram panel:      x=560, y=40, width=720, height=640
 *
 * Skips if any CanvasArtifact rows already exist for the workspace.
 * Should be called on first canvas load (e.g. in the GET /canvas handler).
 */
import { prisma } from '@/lib/prisma';

/** V1 default positions matching StudioLayout split ratio (2/5 left, 3/5 right). */
const V1_POSITIONS = {
  conversation: { x: 40, y: 40, width: 480, height: 640 },
  diagram: { x: 560, y: 40, width: 720, height: 640 },
} as const;

/**
 * Seeds the two V1 default artifacts for the given workspace.
 * - If `diagramId` is provided, the diagram artifact links to it via `refId`.
 * - No-ops if CanvasArtifact rows already exist for the workspace.
 */
export async function migrateV1ToCanvas(
  workspaceId: string,
  options: { diagramId?: string } = {}
): Promise<void> {
  const existing = await prisma.canvasArtifact.count({ where: { workspaceId } });
  if (existing > 0) return;

  await prisma.canvasArtifact.createMany({
    data: [
      {
        workspaceId,
        type: 'conversation',
        title: 'Conversation',
        x: V1_POSITIONS.conversation.x,
        y: V1_POSITIONS.conversation.y,
        width: V1_POSITIONS.conversation.width,
        height: V1_POSITIONS.conversation.height,
        zIndex: 0,
      },
      {
        workspaceId,
        type: 'diagram',
        refId: options.diagramId ?? null,
        title: 'Diagram',
        x: V1_POSITIONS.diagram.x,
        y: V1_POSITIONS.diagram.y,
        width: V1_POSITIONS.diagram.width,
        height: V1_POSITIONS.diagram.height,
        zIndex: 0,
      },
    ],
  });
}
