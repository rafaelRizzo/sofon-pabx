/*
  Warnings:

  - You are about to drop the column `namedcallgroup` on the `ps_endpoints` table. All the data in the column will be lost.
  - You are about to drop the column `namedpickupgroup` on the `ps_endpoints` table. All the data in the column will be lost.
  - You are about to drop the column `setvar` on the `ps_endpoints` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ps_endpoints" DROP COLUMN "namedcallgroup",
DROP COLUMN "namedpickupgroup",
DROP COLUMN "setvar",
ADD COLUMN     "named_call_group" VARCHAR(256),
ADD COLUMN     "named_pickup_group" VARCHAR(256),
ADD COLUMN     "set_var" VARCHAR(200);
