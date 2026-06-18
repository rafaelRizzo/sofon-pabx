-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ps_endpoints" ADD COLUMN     "outbound_auth" VARCHAR(200);

-- CreateTable
CREATE TABLE "trunks_app" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "registrationMode" VARCHAR(10) NOT NULL,
    "host" VARCHAR(255),
    "username" VARCHAR(80),
    "password" VARCHAR(80),
    "context" VARCHAR(40) NOT NULL DEFAULT 'from-trunk',
    "codecs" VARCHAR(200) NOT NULL DEFAULT 'ulaw,alaw',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trunks_app_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ps_registrations" (
    "id" VARCHAR(40) NOT NULL,
    "transport" VARCHAR(40),
    "outbound_auth" VARCHAR(40),
    "server_uri" VARCHAR(256),
    "client_uri" VARCHAR(256),
    "contact_user" VARCHAR(40),
    "expiration" INTEGER DEFAULT 3600,
    "retry_interval" INTEGER DEFAULT 60,
    "max_retries" INTEGER DEFAULT 10,
    "auth_rejection_permanent" BOOLEAN DEFAULT true,
    "support_path" BOOLEAN DEFAULT false,
    "endpoint" VARCHAR(40),

    CONSTRAINT "ps_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trunks_app_companyId_idx" ON "trunks_app"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "trunks_app_name_companyId_key" ON "trunks_app"("name", "companyId");

-- CreateIndex
CREATE INDEX "ps_contacts_endpoint_idx" ON "ps_contacts"("endpoint");

-- AddForeignKey
ALTER TABLE "trunks_app" ADD CONSTRAINT "trunks_app_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
