/*
  Warnings:

  - A unique constraint covering the columns `[number,companyId]` on the table `queues_app` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queues_app" ADD COLUMN     "number" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "queues_app_number_companyId_key" ON "queues_app"("number", "companyId");
