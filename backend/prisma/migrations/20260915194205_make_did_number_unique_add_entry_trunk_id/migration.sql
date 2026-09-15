/*
  Warnings:

  - A unique constraint covering the columns `[number]` on the table `dids` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "dids_number_companyId_key";

-- AlterTable
ALTER TABLE "cdr" ADD COLUMN     "entry_trunk_id" VARCHAR(40);

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateIndex
CREATE UNIQUE INDEX "dids_number_key" ON "dids"("number");
