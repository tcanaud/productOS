/**
 * migrateV1ToCanvas — Story 8.1 / Story 8.3
 *
 * Idempotent helper that seeds CanvasArtifact rows for a workspace
 * based on the V1 split-view layout:
 *
 *   conversation panel: x=40,  y=40, width=480, height=640
 *   diagram panel:      x=560, y=40, width=720, height=640
 *
 * Story 8.3 extension: after seeding artifacts, creates an idempotent
 * conversation→diagram connection (label: "generates") so existing workspaces
 * show a connection line on first canvas load.
 *
 * Skips artifact seeding if any CanvasArtifact rows already exist for the workspace.
 * Should be called on first canvas load (e.g. in the GET /canvas handler).
 */
import { prisma } from '@/lib/prisma';

/** V1 default positions matching StudioLayout split ratio (2/5 left, 3/5 right). */
const V1_POSITIONS = {
  conversation: { x: 40, y: 40, width: 480, height: 640 },
  diagram: { x: 560, y: 40, width: 720, height: 640 },
} as const;

/**
 * Seeds the two V1 default artifacts for the given workspace and creates
 * an idempotent conversation→diagram connection.
 * - If `diagramId` is provided, the diagram artifact links to it via `refId`.
 * - No-ops artifact seeding if CanvasArtifact rows already exist for the workspace.
 * - Always attempts to backfill the connection if the two artifacts exist.
 */
export async function migrateV1ToCanvas(
  workspaceId: string,
  options: { diagramId?: string } = {}
): Promise<void> {
  const existing = await prisma.canvasArtifact.count({ where: { workspaceId } });

  if (existing === 0) {
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

  // Story 8.3: Backfill conversation→diagram connection (idempotent).
  // Find the two canonical V1 artifacts and connect them if not already linked.
  const [convArtifact, diagramArtifact] = await Promise.all([
    prisma.canvasArtifact.findFirst({
      where: { workspaceId, type: 'conversation' },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.canvasArtifact.findFirst({
      where: { workspaceId, type: 'diagram' },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!convArtifact || !diagramArtifact) return;

  const connectionExists = await prisma.canvasConnection.findFirst({
    where: { sourceId: convArtifact.id, targetId: diagramArtifact.id },
  });

  if (!connectionExists) {
    await prisma.canvasConnection.create({
      data: {
        sourceId: convArtifact.id,
        targetId: diagramArtifact.id,
        label: 'generates',
      },
    });
  }
}
