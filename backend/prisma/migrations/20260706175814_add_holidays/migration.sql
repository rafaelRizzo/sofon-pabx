-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "month" INTEGER,
    "day" INTEGER,
    "offset" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_conditions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "trueRoute" JSONB,
    "falseRoute" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "holiday_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holidays_name_key" ON "holidays"("name");

-- CreateIndex
CREATE INDEX "holiday_conditions_companyId_idx" ON "holiday_conditions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_conditions_name_companyId_key" ON "holiday_conditions"("name", "companyId");

-- AddForeignKey
ALTER TABLE "holiday_conditions" ADD CONSTRAINT "holiday_conditions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
