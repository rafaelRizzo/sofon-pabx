/*
  Warnings:

  - A unique constraint covering the columns `[entryNodeId]` on the table `flows` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "flows" ADD COLUMN     "entryNodeId" TEXT;

-- CreateTable
CREATE TABLE "flow_nodes" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "resourceId" TEXT,
    "label" VARCHAR(80),
    "position" JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "flow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_node_edges" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "sourcePort" VARCHAR(40) NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "flow_node_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_nodes_flowId_idx" ON "flow_nodes"("flowId");

-- CreateIndex
CREATE INDEX "flow_nodes_type_resourceId_idx" ON "flow_nodes"("type", "resourceId");

-- CreateIndex
CREATE INDEX "flow_node_edges_flowId_idx" ON "flow_node_edges"("flowId");

-- CreateIndex
CREATE INDEX "flow_node_edges_targetNodeId_idx" ON "flow_node_edges"("targetNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_node_edges_sourceNodeId_sourcePort_key" ON "flow_node_edges"("sourceNodeId", "sourcePort");

-- CreateIndex
CREATE UNIQUE INDEX "flows_entryNodeId_key" ON "flows"("entryNodeId");

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_entryNodeId_fkey" FOREIGN KEY ("entryNodeId") REFERENCES "flow_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_nodes" ADD CONSTRAINT "flow_nodes_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_node_edges" ADD CONSTRAINT "flow_node_edges_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_node_edges" ADD CONSTRAINT "flow_node_edges_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "flow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_node_edges" ADD CONSTRAINT "flow_node_edges_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "flow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
