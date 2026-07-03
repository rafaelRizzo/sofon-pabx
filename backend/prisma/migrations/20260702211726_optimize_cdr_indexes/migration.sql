-- DropIndex
DROP INDEX "cdr_accountcode_idx";

-- DropIndex
DROP INDEX "cdr_start_idx";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateIndex
CREATE INDEX "cdr_accountcode_start_idx" ON "cdr"("accountcode", "start" DESC);
