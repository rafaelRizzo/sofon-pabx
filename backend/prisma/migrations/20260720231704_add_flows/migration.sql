/*
  Warnings:

  - You are about to drop the column `destination` on the `announcements` table. All the data in the column will be lost.
  - You are about to drop the column `falseRoute` on the `holiday_groups` table. All the data in the column will be lost.
  - You are about to drop the column `trueRoute` on the `holiday_groups` table. All the data in the column will be lost.
  - You are about to drop the column `destination` on the `inbound_routes` table. All the data in the column will be lost.
  - You are about to drop the column `invalidDestination` on the `ivr_menus` table. All the data in the column will be lost.
  - You are about to drop the column `longDestination` on the `ivr_menus` table. All the data in the column will be lost.
  - You are about to drop the column `timeoutDestination` on the `ivr_menus` table. All the data in the column will be lost.
  - You are about to drop the column `destination` on the `ivr_options` table. All the data in the column will be lost.
  - You are about to drop the column `postQueueDestination` on the `queues_app` table. All the data in the column will be lost.
  - You are about to drop the column `onError` on the `request_templates` table. All the data in the column will be lost.
  - You are about to drop the column `onSuccess` on the `request_templates` table. All the data in the column will be lost.
  - You are about to drop the column `falseRoute` on the `time_conditions` table. All the data in the column will be lost.
  - You are about to drop the column `trueRoute` on the `time_conditions` table. All the data in the column will be lost.
  - You are about to drop the column `falseRoute` on the `variable_conditions` table. All the data in the column will be lost.
  - You are about to drop the column `trueRoute` on the `variable_conditions` table. All the data in the column will be lost.
  - You are about to drop the column `destination` on the `variable_sets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "announcements" DROP COLUMN "destination";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "holiday_groups" DROP COLUMN "falseRoute",
DROP COLUMN "trueRoute";

-- AlterTable
ALTER TABLE "inbound_routes" DROP COLUMN "destination";

-- AlterTable
ALTER TABLE "ivr_menus" DROP COLUMN "invalidDestination",
DROP COLUMN "longDestination",
DROP COLUMN "timeoutDestination";

-- AlterTable
ALTER TABLE "ivr_options" DROP COLUMN "destination";

-- AlterTable
ALTER TABLE "queues_app" DROP COLUMN "postQueueDestination";

-- AlterTable
ALTER TABLE "request_templates" DROP COLUMN "onError",
DROP COLUMN "onSuccess";

-- AlterTable
ALTER TABLE "time_conditions" DROP COLUMN "falseRoute",
DROP COLUMN "trueRoute";

-- AlterTable
ALTER TABLE "variable_conditions" DROP COLUMN "falseRoute",
DROP COLUMN "trueRoute";

-- AlterTable
ALTER TABLE "variable_sets" DROP COLUMN "destination";

-- CreateTable
CREATE TABLE "flows" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flows_companyId_idx" ON "flows"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "flows_name_companyId_key" ON "flows"("name", "companyId");

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
