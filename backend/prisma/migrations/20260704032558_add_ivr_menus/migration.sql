-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "ivr_menus" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "audioUploadedAt" TIMESTAMPTZ(3),
    "maxDigits" INTEGER NOT NULL DEFAULT 1,
    "digitTimeout" INTEGER NOT NULL DEFAULT 5,
    "invalidRetries" INTEGER NOT NULL DEFAULT 3,
    "invalidDestination" JSONB,
    "timeoutRetries" INTEGER NOT NULL DEFAULT 3,
    "timeoutDestination" JSONB,
    "longDestination" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ivr_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ivr_options" (
    "id" TEXT NOT NULL,
    "ivrMenuId" TEXT NOT NULL,
    "digit" VARCHAR(1) NOT NULL,
    "destination" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ivr_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ivr_menus_companyId_idx" ON "ivr_menus"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ivr_menus_name_companyId_key" ON "ivr_menus"("name", "companyId");

-- CreateIndex
CREATE INDEX "ivr_options_ivrMenuId_idx" ON "ivr_options"("ivrMenuId");

-- CreateIndex
CREATE UNIQUE INDEX "ivr_options_ivrMenuId_digit_key" ON "ivr_options"("ivrMenuId", "digit");

-- AddForeignKey
ALTER TABLE "ivr_menus" ADD CONSTRAINT "ivr_menus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivr_options" ADD CONSTRAINT "ivr_options_ivrMenuId_fkey" FOREIGN KEY ("ivrMenuId") REFERENCES "ivr_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
