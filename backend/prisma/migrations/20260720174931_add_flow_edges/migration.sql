-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "flow_edges" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "flow_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_edges_companyId_idx" ON "flow_edges"("companyId");

-- CreateIndex
CREATE INDEX "flow_edges_targetType_targetId_idx" ON "flow_edges"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_edges_sourceType_sourceId_slot_key" ON "flow_edges"("sourceType", "sourceId", "slot");

-- AddForeignKey
ALTER TABLE "flow_edges" ADD CONSTRAINT "flow_edges_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
