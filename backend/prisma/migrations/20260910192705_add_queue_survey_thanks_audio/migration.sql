-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queues_app" ADD COLUMN     "surveyThanksAudioId" TEXT;

-- CreateIndex
CREATE INDEX "queues_app_surveyThanksAudioId_idx" ON "queues_app"("surveyThanksAudioId");

-- AddForeignKey
ALTER TABLE "queues_app" ADD CONSTRAINT "queues_app_surveyThanksAudioId_fkey" FOREIGN KEY ("surveyThanksAudioId") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
