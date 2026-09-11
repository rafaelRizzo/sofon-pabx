-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queues_app" ADD COLUMN     "mohAudioId" TEXT;

-- CreateIndex
CREATE INDEX "queues_app_mohAudioId_idx" ON "queues_app"("mohAudioId");

-- AddForeignKey
ALTER TABLE "queues_app" ADD CONSTRAINT "queues_app_mohAudioId_fkey" FOREIGN KEY ("mohAudioId") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
