/*
  Warnings:

  - You are about to drop the column `call_group` on the `ps_endpoints` table. All the data in the column will be lost.
  - You are about to drop the column `pickup_group` on the `ps_endpoints` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ps_endpoints" DROP COLUMN "call_group",
DROP COLUMN "pickup_group",
ADD COLUMN     "namedcallgroup" VARCHAR(256),
ADD COLUMN     "namedpickupgroup" VARCHAR(256);
