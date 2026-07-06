/*
  Warnings:

  - You are about to drop the column `exten` on the `dids` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "dids" DROP COLUMN "exten";
