-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateIndex
CREATE INDEX "queues_app_announce_idx" ON "queues_app"("announce");

-- CreateIndex
CREATE INDEX "queues_app_periodicAnnounce_idx" ON "queues_app"("periodicAnnounce");

-- AddForeignKey
ALTER TABLE "queues_app" ADD CONSTRAINT "queues_app_announce_fkey" FOREIGN KEY ("announce") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues_app" ADD CONSTRAINT "queues_app_periodicAnnounce_fkey" FOREIGN KEY ("periodicAnnounce") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
