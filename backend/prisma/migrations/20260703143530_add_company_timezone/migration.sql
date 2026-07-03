-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);
