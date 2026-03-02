-- CreateTable
CREATE TABLE "Diagram" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "diagramType" TEXT NOT NULL DEFAULT 'flowchart',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagramVersion" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagramVersion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagramVersion" ADD CONSTRAINT "DiagramVersion_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
