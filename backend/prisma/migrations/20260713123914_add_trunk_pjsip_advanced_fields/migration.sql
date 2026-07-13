-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "trunks_app" ADD COLUMN     "directMedia" BOOLEAN,
ADD COLUMN     "dtmfMode" VARCHAR(40),
ADD COLUMN     "iceSupport" BOOLEAN,
ADD COLUMN     "outboundProxy" VARCHAR(40),
ADD COLUMN     "qualifyFrequency" INTEGER,
ADD COLUMN     "qualifyTimeout" DOUBLE PRECISION,
ADD COLUMN     "rel" VARCHAR(40),
ADD COLUMN     "sendDiversion" BOOLEAN,
ADD COLUMN     "timers" VARCHAR(40),
ADD COLUMN     "timersMinSe" INTEGER,
ADD COLUMN     "timersSessExpires" INTEGER,
ADD COLUMN     "transport" VARCHAR(40);
