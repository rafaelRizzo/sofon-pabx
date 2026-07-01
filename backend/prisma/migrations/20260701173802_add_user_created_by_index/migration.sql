-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateIndex
CREATE INDEX "users_createdBy_idx" ON "users"("createdBy");
