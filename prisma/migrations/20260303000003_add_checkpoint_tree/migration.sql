-- AlterTable
ALTER TABLE "Studio" ADD COLUMN "headCheckpointId" TEXT,
ADD COLUMN "activeBranchName" TEXT NOT NULL DEFAULT 'main';

-- CreateTable
CREATE TABLE "StudioCheckpoint" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "parentId" TEXT,
    "branchName" TEXT NOT NULL DEFAULT 'main',
    "turnNumber" INTEGER NOT NULL,
    "checkpoint" JSONB NOT NULL,
    "graphState" JSONB NOT NULL,
    "messageHistory" JSONB,
    "userMessage" TEXT NOT NULL,
    "mermaidPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioCheckpoint_studioId_branchName_turnNumber_idx" ON "StudioCheckpoint"("studioId", "branchName", "turnNumber");

-- CreateIndex
CREATE INDEX "StudioCheckpoint_studioId_createdAt_idx" ON "StudioCheckpoint"("studioId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudioCheckpoint" ADD CONSTRAINT "StudioCheckpoint_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioCheckpoint" ADD CONSTRAINT "StudioCheckpoint_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StudioCheckpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
