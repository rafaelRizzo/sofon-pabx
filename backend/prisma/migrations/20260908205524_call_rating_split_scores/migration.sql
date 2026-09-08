/*
  Warnings:

  - You are about to drop the column `category` on the `call_ratings` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `call_ratings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[companyId,uniqueid]` on the table `call_ratings` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "call_ratings" DROP COLUMN "category",
DROP COLUMN "score",
ADD COLUMN     "scoreAtendimento" INTEGER,
ADD COLUMN     "scoreServico" INTEGER;

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateIndex
CREATE UNIQUE INDEX "call_ratings_companyId_uniqueid_key" ON "call_ratings"("companyId", "uniqueid");
