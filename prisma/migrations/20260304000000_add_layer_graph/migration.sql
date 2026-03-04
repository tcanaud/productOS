-- CreateTable
CREATE TABLE "LayerGraph" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentNodeId" TEXT,
    "parentGraphId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "ports" JSONB NOT NULL DEFAULT '[]',
    "graph" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LayerGraph_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LayerGraph_workspaceId_idx" ON "LayerGraph"("workspaceId");

-- CreateIndex
CREATE INDEX "LayerGraph_parentGraphId_idx" ON "LayerGraph"("parentGraphId");

-- AddForeignKey
ALTER TABLE "LayerGraph" ADD CONSTRAINT "LayerGraph_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LayerGraph" ADD CONSTRAINT "LayerGraph_parentGraphId_fkey" FOREIGN KEY ("parentGraphId") REFERENCES "LayerGraph"("id") ON DELETE SET NULL ON UPDATE CASCADE;
