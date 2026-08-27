-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "variable_catalog" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "description" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "variable_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variable_catalog_companyId_idx" ON "variable_catalog"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "variable_catalog_name_companyId_key" ON "variable_catalog"("name", "companyId");

-- AddForeignKey
ALTER TABLE "variable_catalog" ADD CONSTRAINT "variable_catalog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
