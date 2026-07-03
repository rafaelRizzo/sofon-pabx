-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ps_endpoints" ALTER COLUMN "rewrite_contact" SET DEFAULT true,
ALTER COLUMN "rtp_symmetric" SET DEFAULT true;
