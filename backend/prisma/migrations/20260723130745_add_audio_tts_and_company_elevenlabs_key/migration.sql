-- CreateEnum
CREATE TYPE "AudioSource" AS ENUM ('UPLOAD', 'TTS');

-- AlterTable
ALTER TABLE "audios" ADD COLUMN     "source" "AudioSource" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN     "ttsText" TEXT,
ADD COLUMN     "ttsVoiceId" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "elevenLabsApiKey" TEXT,
ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);
