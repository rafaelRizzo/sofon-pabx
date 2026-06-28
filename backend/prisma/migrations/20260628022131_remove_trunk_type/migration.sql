/*
  Warnings:

  - You are about to drop the column `type` on the `trunks_app` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "trunks_app" DROP COLUMN "type";
