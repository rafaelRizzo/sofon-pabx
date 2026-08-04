/*
  Warnings:

  - You are about to drop the column `ttsProvider` on the `audios` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "audios" DROP COLUMN "ttsProvider";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- DropEnum
DROP TYPE "TtsProvider";
