-- Multi-Studio Persistence: Studio model

CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Studio',
    "status" TEXT NOT NULL DEFAULT 'active',
    "graphState" JSONB,
    "checkpoint" JSONB,
    "sseSessionId" TEXT,
    "messageHistory" JSONB,
    "diagramId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on diagramId (one-to-one with Diagram)
CREATE UNIQUE INDEX "Studio_diagramId_key" ON "Studio"("diagramId");

-- Composite index for listing studios by workspace
CREATE INDEX "Studio_workspaceId_updatedAt_idx" ON "Studio"("workspaceId", "updatedAt");

-- AddForeignKey: Studio → Workspace
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Studio → Diagram (optional)
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_diagramId_fkey"
    FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
