-- AlterTable
ALTER TABLE "audios" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "notes" TEXT,
ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "dids" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "flows" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "holiday_groups" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "inbound_routes" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "outbound_routes" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "phone_extensions" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "queues_app" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "time_groups" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "trunks_app" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notes" TEXT;
