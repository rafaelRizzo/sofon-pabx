/*
  Warnings:

  - You are about to drop the `holiday_conditions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `holidays` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "holiday_conditions" DROP CONSTRAINT "holiday_conditions_companyId_fkey";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- DropTable
DROP TABLE "holiday_conditions";

-- DropTable
DROP TABLE "holidays";

-- CreateTable
CREATE TABLE "holiday_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" VARCHAR(500),
    "trueRoute" JSONB,
    "falseRoute" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "holiday_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_dates" (
    "id" TEXT NOT NULL,
    "holidayGroupId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holiday_groups_companyId_idx" ON "holiday_groups"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_groups_name_companyId_key" ON "holiday_groups"("name", "companyId");

-- CreateIndex
CREATE INDEX "holiday_dates_holidayGroupId_idx" ON "holiday_dates"("holidayGroupId");

-- AddForeignKey
ALTER TABLE "holiday_groups" ADD CONSTRAINT "holiday_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_dates" ADD CONSTRAINT "holiday_dates_holidayGroupId_fkey" FOREIGN KEY ("holidayGroupId") REFERENCES "holiday_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
