-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "formatter_nodes" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "inputVariable" VARCHAR(120) NOT NULL,
    "outputVariable" VARCHAR(80) NOT NULL,
    "masks" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "formatter_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "formatter_nodes_companyId_idx" ON "formatter_nodes"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "formatter_nodes_name_companyId_key" ON "formatter_nodes"("name", "companyId");

-- AddForeignKey
ALTER TABLE "formatter_nodes" ADD CONSTRAINT "formatter_nodes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
