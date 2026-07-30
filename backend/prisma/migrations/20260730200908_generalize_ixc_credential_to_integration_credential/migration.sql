/*
  Warnings:

  - You are about to drop the `ixc_credentials` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ixc_credentials" DROP CONSTRAINT "ixc_credentials_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ixc_nodes" DROP CONSTRAINT "ixc_nodes_credentialId_fkey";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- DropTable
DROP TABLE "ixc_credentials";

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenTag" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_credentials_companyId_idx" ON "integration_credentials"("companyId");

-- CreateIndex
CREATE INDEX "integration_credentials_provider_companyId_idx" ON "integration_credentials"("provider", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_provider_name_companyId_key" ON "integration_credentials"("provider", "name", "companyId");

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ixc_nodes" ADD CONSTRAINT "ixc_nodes_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "integration_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
