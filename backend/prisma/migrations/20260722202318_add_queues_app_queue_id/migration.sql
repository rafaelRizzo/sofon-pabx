/*
  Warnings:

  - A unique constraint covering the columns `[appQueueId]` on the table `queues` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queues" ADD COLUMN     "appQueueId" VARCHAR(30);

-- CreateIndex
CREATE UNIQUE INDEX "queues_appQueueId_key" ON "queues"("appQueueId");
