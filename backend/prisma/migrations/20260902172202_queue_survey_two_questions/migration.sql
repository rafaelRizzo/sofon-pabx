-- AlterTable
ALTER TABLE "call_ratings" ADD COLUMN     "category" VARCHAR(20) NOT NULL DEFAULT 'atendimento';

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queues_app" ADD COLUMN     "surveyServiceAudioId" TEXT;

-- CreateIndex
CREATE INDEX "queues_app_surveyServiceAudioId_idx" ON "queues_app"("surveyServiceAudioId");

-- AddForeignKey
ALTER TABLE "queues_app" ADD CONSTRAINT "queues_app_surveyServiceAudioId_fkey" FOREIGN KEY ("surveyServiceAudioId") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
