/*
  Warnings:

  - A unique constraint covering the columns `[asteriskId]` on the table `companies` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "asteriskId" VARCHAR(10) NOT NULL DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateIndex
CREATE UNIQUE INDEX "companies_asteriskId_key" ON "companies"("asteriskId");
