-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queues_app" ADD COLUMN     "agentAnnounce" TEXT;

-- CreateIndex
CREATE INDEX "queues_app_agentAnnounce_idx" ON "queues_app"("agentAnnounce");

-- AddForeignKey
ALTER TABLE "queues_app" ADD CONSTRAINT "queues_app_agentAnnounce_fkey" FOREIGN KEY ("agentAnnounce") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
