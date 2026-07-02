/*
  Warnings:

  - You are about to drop the column `end` on the `cdr` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cdr" DROP COLUMN "end",
ADD COLUMN     "endtime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);
