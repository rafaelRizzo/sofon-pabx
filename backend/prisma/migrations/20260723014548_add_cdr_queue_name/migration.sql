-- AlterTable
ALTER TABLE "cdr" ADD COLUMN     "queue_name" VARCHAR(160);

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateIndex
CREATE INDEX "cdr_queue_name_start_idx" ON "cdr"("queue_name", "start");
