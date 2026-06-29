-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ps_endpoints" ADD COLUMN     "call_group" VARCHAR(40),
ADD COLUMN     "pickup_group" VARCHAR(40);
