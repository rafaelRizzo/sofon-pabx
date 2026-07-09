-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "queues" ADD COLUMN     "announce-position" VARCHAR(10) DEFAULT 'no',
ADD COLUMN     "periodic-announce" VARCHAR(128),
ADD COLUMN     "periodic-announce-frequency" INTEGER DEFAULT 60,
ALTER COLUMN "wrapuptime" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "queues_app" ADD COLUMN     "announcePosition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "periodicAnnounce" TEXT,
ADD COLUMN     "periodicAnnounceFrequency" INTEGER NOT NULL DEFAULT 60,
ALTER COLUMN "wrapupTime" SET DEFAULT 5;
