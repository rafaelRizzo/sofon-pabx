/*
  Warnings:

  - The `trueRoute` column on the `time_conditions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `falseRoute` column on the `time_conditions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "outbound_route_trunks" DROP CONSTRAINT "outbound_route_trunks_trunkId_fkey";

-- DropForeignKey
ALTER TABLE "time_condition_time_groups" DROP CONSTRAINT "time_condition_time_groups_timeGroupId_fkey";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "dids" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "outbound_dial_patterns" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "outbound_routes" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "phone_extensions" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "queue_members_app" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "queues_app" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "time_conditions" DROP COLUMN "trueRoute",
ADD COLUMN     "trueRoute" JSONB,
DROP COLUMN "falseRoute",
ADD COLUMN     "falseRoute" JSONB,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "time_groups" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "time_ranges" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "trunks_app" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "dids_companyId_idx" ON "dids"("companyId");

-- CreateIndex
CREATE INDEX "queue_members_app_extensionId_idx" ON "queue_members_app"("extensionId");

-- CreateIndex
CREATE INDEX "time_condition_time_groups_timeGroupId_idx" ON "time_condition_time_groups"("timeGroupId");

-- CreateIndex
CREATE INDEX "time_ranges_timeGroupId_idx" ON "time_ranges"("timeGroupId");

-- CreateIndex
CREATE INDEX "user_companies_companyId_idx" ON "user_companies"("companyId");

-- AddForeignKey
ALTER TABLE "outbound_route_trunks" ADD CONSTRAINT "outbound_route_trunks_trunkId_fkey" FOREIGN KEY ("trunkId") REFERENCES "trunks_app"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_condition_time_groups" ADD CONSTRAINT "time_condition_time_groups_timeGroupId_fkey" FOREIGN KEY ("timeGroupId") REFERENCES "time_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
