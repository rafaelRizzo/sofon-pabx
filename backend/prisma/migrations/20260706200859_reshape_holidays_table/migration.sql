/*
  Warnings:

  - You are about to drop the column `kind` on the `holidays` table. All the data in the column will be lost.
  - You are about to drop the column `offset` on the `holidays` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,year]` on the table `holidays` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `source` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Made the column `month` on table `holidays` required. This step will fail if there are existing NULL values in that column.
  - Made the column `day` on table `holidays` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "holidays_name_key";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "holidays" DROP COLUMN "kind",
DROP COLUMN "offset",
ADD COLUMN     "source" VARCHAR(20) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL,
ALTER COLUMN "month" SET NOT NULL,
ALTER COLUMN "day" SET NOT NULL;

-- CreateIndex
CREATE INDEX "holidays_year_idx" ON "holidays"("year");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_name_year_key" ON "holidays"("name", "year");
