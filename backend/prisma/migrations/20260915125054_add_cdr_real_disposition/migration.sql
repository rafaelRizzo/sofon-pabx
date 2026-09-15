-- AlterTable
ALTER TABLE "cdr" ADD COLUMN     "real_disposition" VARCHAR(20);

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);
