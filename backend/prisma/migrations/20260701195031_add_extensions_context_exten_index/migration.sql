-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateIndex
CREATE INDEX "extensions_context_exten_idx" ON "extensions"("context", "exten");
