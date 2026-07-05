/*
  Warnings:

  - You are about to drop the column `audioUploadedAt` on the `announcements` table. All the data in the column will be lost.
  - You are about to drop the column `audioUploadedAt` on the `ivr_menus` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "announcements" DROP COLUMN "audioUploadedAt",
ADD COLUMN     "audioId" TEXT;

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ivr_menus" DROP COLUMN "audioUploadedAt",
ADD COLUMN     "audioId" TEXT;

-- CreateTable
CREATE TABLE "audios" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audios_companyId_idx" ON "audios"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "audios_name_companyId_key" ON "audios"("name", "companyId");

-- CreateIndex
CREATE INDEX "announcements_audioId_idx" ON "announcements"("audioId");

-- CreateIndex
CREATE INDEX "ivr_menus_audioId_idx" ON "ivr_menus"("audioId");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audios" ADD CONSTRAINT "audios_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivr_menus" ADD CONSTRAINT "ivr_menus_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
