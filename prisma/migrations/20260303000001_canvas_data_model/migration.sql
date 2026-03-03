-- Story 8.1: Canvas Data Model
-- CreateTable: CanvasArtifact

CREATE TABLE "CanvasArtifact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 480,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 360,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CanvasConnection

CREATE TABLE "CanvasConnection" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasConnection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: CanvasArtifact → Workspace

ALTER TABLE "CanvasArtifact" ADD CONSTRAINT "CanvasArtifact_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CanvasConnection → CanvasArtifact (source)

ALTER TABLE "CanvasConnection" ADD CONSTRAINT "CanvasConnection_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "CanvasArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CanvasConnection → CanvasArtifact (target)

ALTER TABLE "CanvasConnection" ADD CONSTRAINT "CanvasConnection_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "CanvasArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
