-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ps_aors" ADD CONSTRAINT "ps_aors_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "ps_aors_id_key";

-- AlterTable
ALTER TABLE "ps_auths" ADD CONSTRAINT "ps_auths_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "ps_auths_id_key";

-- AlterTable
ALTER TABLE "ps_contacts" ADD CONSTRAINT "ps_contacts_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "ps_contacts_id_key";

-- AlterTable
ALTER TABLE "ps_endpoints" ADD CONSTRAINT "ps_endpoints_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "ps_endpoints_id_key";
