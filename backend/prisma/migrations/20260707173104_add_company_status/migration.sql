-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);
