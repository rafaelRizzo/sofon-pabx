-- CreateEnum
CREATE TYPE "TtsProvider" AS ENUM ('ELEVENLABS', 'KOKORO');

-- AlterTable
ALTER TABLE "audios" ADD COLUMN     "ttsProvider" "TtsProvider";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);
