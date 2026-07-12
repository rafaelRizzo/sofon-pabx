-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "variable_sets" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignments" JSONB NOT NULL DEFAULT '[]',
    "destination" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "variable_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variable_conditions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "combinator" TEXT NOT NULL DEFAULT 'and',
    "rules" JSONB NOT NULL DEFAULT '[]',
    "trueRoute" JSONB,
    "falseRoute" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "variable_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variable_sets_companyId_idx" ON "variable_sets"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "variable_sets_name_companyId_key" ON "variable_sets"("name", "companyId");

-- CreateIndex
CREATE INDEX "variable_conditions_companyId_idx" ON "variable_conditions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "variable_conditions_name_companyId_key" ON "variable_conditions"("name", "companyId");

-- AddForeignKey
ALTER TABLE "variable_sets" ADD CONSTRAINT "variable_sets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variable_conditions" ADD CONSTRAINT "variable_conditions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
