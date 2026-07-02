-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queue_members" ADD COLUMN     "reason_paused" VARCHAR(80);

-- AlterTable
ALTER TABLE "queue_members_app" ADD COLUMN     "pauseReason" VARCHAR(80);
