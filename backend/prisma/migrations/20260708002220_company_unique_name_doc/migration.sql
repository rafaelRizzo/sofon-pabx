/*
  Warnings:

  - A unique constraint covering the columns `[name,doc]` on the table `companies` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "sip_peers" ALTER COLUMN "insecure" SET DEFAULT 'port,invite';

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_doc_key" ON "companies"("name", "doc");
