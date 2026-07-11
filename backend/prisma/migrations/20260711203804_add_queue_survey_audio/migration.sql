-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queues_app" ADD COLUMN     "surveyAudioId" TEXT;

-- CreateIndex
CREATE INDEX "queues_app_surveyAudioId_idx" ON "queues_app"("surveyAudioId");

-- AddForeignKey
ALTER TABLE "queues_app" ADD CONSTRAINT "queues_app_surveyAudioId_fkey" FOREIGN KEY ("surveyAudioId") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
