-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "pause_reasons" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pause_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pause_reasons_companyId_idx" ON "pause_reasons"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "pause_reasons_companyId_label_key" ON "pause_reasons"("companyId", "label");

-- AddForeignKey
ALTER TABLE "pause_reasons" ADD CONSTRAINT "pause_reasons_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
