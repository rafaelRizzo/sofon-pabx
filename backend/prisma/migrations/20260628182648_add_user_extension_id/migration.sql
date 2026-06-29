/*
  Warnings:

  - A unique constraint covering the columns `[extensionId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ps_identifies" ADD COLUMN     "match_header" VARCHAR(255),
ALTER COLUMN "srv_lookups" SET DEFAULT 'no',
ALTER COLUMN "srv_lookups" SET DATA TYPE VARCHAR(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "extensionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_extensionId_key" ON "users"("extensionId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "phone_extensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
