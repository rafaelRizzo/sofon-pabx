-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "time_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_ranges" (
    "id" TEXT NOT NULL,
    "timeGroupId" TEXT NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "weekdays" TEXT[],
    "monthdays" VARCHAR(20) NOT NULL DEFAULT '*',
    "months" VARCHAR(40) NOT NULL DEFAULT '*',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_conditions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "trueRoute" VARCHAR(120),
    "falseRoute" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_condition_time_groups" (
    "timeConditionId" TEXT NOT NULL,
    "timeGroupId" TEXT NOT NULL,

    CONSTRAINT "time_condition_time_groups_pkey" PRIMARY KEY ("timeConditionId","timeGroupId")
);

-- CreateIndex
CREATE INDEX "time_groups_companyId_idx" ON "time_groups"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "time_groups_name_companyId_key" ON "time_groups"("name", "companyId");

-- CreateIndex
CREATE INDEX "time_conditions_companyId_idx" ON "time_conditions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "time_conditions_name_companyId_key" ON "time_conditions"("name", "companyId");

-- AddForeignKey
ALTER TABLE "time_groups" ADD CONSTRAINT "time_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_ranges" ADD CONSTRAINT "time_ranges_timeGroupId_fkey" FOREIGN KEY ("timeGroupId") REFERENCES "time_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_conditions" ADD CONSTRAINT "time_conditions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_condition_time_groups" ADD CONSTRAINT "time_condition_time_groups_timeConditionId_fkey" FOREIGN KEY ("timeConditionId") REFERENCES "time_conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_condition_time_groups" ADD CONSTRAINT "time_condition_time_groups_timeGroupId_fkey" FOREIGN KEY ("timeGroupId") REFERENCES "time_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
