/*
  Warnings:

  - The values [admin,agent] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - The `successDestinationApp` column on the `api_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `failureDestinationApp` column on the `api_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `timeoutDestinationApp` column on the `ivrs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `invalidDestinationApp` column on the `ivrs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `destinationApp` on the `announcements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `destinationApp` on the `inbound_routes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `destinationApp` on the `ivr_options` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `destinationApp` on the `set_variables` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `trueDestinationApp` on the `timeconditions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `falseDestinationApp` on the `timeconditions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ApplicationsType" AS ENUM ('ANNOUNCEMENT', 'TIMECONDITION', 'QUEUE', 'IVR', 'EXTENSION', 'TRUNK', 'SETVARIABLE', 'API');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'AGENT');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'AGENT';
COMMIT;

-- AlterTable
ALTER TABLE "announcements" DROP COLUMN "destinationApp",
ADD COLUMN     "destinationApp" "ApplicationsType" NOT NULL;

-- AlterTable
ALTER TABLE "api_requests" DROP COLUMN "successDestinationApp",
ADD COLUMN     "successDestinationApp" "ApplicationsType",
DROP COLUMN "failureDestinationApp",
ADD COLUMN     "failureDestinationApp" "ApplicationsType";

-- AlterTable
ALTER TABLE "inbound_routes" DROP COLUMN "destinationApp",
ADD COLUMN     "destinationApp" "ApplicationsType" NOT NULL;

-- AlterTable
ALTER TABLE "ivr_options" DROP COLUMN "destinationApp",
ADD COLUMN     "destinationApp" "ApplicationsType" NOT NULL;

-- AlterTable
ALTER TABLE "ivrs" DROP COLUMN "timeoutDestinationApp",
ADD COLUMN     "timeoutDestinationApp" "ApplicationsType",
DROP COLUMN "invalidDestinationApp",
ADD COLUMN     "invalidDestinationApp" "ApplicationsType";

-- AlterTable
ALTER TABLE "set_variables" DROP COLUMN "destinationApp",
ADD COLUMN     "destinationApp" "ApplicationsType" NOT NULL;

-- AlterTable
ALTER TABLE "timeconditions" DROP COLUMN "trueDestinationApp",
ADD COLUMN     "trueDestinationApp" "ApplicationsType" NOT NULL,
DROP COLUMN "falseDestinationApp",
ADD COLUMN     "falseDestinationApp" "ApplicationsType" NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'AGENT';
