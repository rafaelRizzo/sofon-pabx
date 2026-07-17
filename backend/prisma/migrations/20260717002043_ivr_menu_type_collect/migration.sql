-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ivr_menus" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'menu',
ADD COLUMN     "variableName" VARCHAR(80);
