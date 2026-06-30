-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "phone_extensions" ADD COLUMN     "allowOutbound" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ps_endpoints" ADD COLUMN     "setvar" VARCHAR(200);
