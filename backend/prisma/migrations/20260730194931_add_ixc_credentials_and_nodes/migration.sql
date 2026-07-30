-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "ixc_credentials" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenTag" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ixc_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ixc_nodes" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "variableMappings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ixc_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ixc_credentials_companyId_idx" ON "ixc_credentials"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ixc_credentials_name_companyId_key" ON "ixc_credentials"("name", "companyId");

-- CreateIndex
CREATE INDEX "ixc_nodes_companyId_idx" ON "ixc_nodes"("companyId");

-- CreateIndex
CREATE INDEX "ixc_nodes_credentialId_idx" ON "ixc_nodes"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "ixc_nodes_name_companyId_key" ON "ixc_nodes"("name", "companyId");

-- AddForeignKey
ALTER TABLE "ixc_credentials" ADD CONSTRAINT "ixc_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ixc_nodes" ADD CONSTRAINT "ixc_nodes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ixc_nodes" ADD CONSTRAINT "ixc_nodes_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ixc_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
