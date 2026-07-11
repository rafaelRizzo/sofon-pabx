-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "agent_company_scopes" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_company_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_ratings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "number" VARCHAR(80) NOT NULL,
    "uniqueid" VARCHAR(150),
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_affinities" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_affinities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_company_scopes_companyId_idx" ON "agent_company_scopes"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_company_scopes_extensionId_companyId_key" ON "agent_company_scopes"("extensionId", "companyId");

-- CreateIndex
CREATE INDEX "routing_rules_companyId_idx" ON "routing_rules"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "routing_rules_name_companyId_key" ON "routing_rules"("name", "companyId");

-- CreateIndex
CREATE INDEX "call_ratings_companyId_createdAt_idx" ON "call_ratings"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "call_ratings_extensionId_createdAt_idx" ON "call_ratings"("extensionId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_affinities_companyId_idx" ON "agent_affinities"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_affinities_extensionId_companyId_key" ON "agent_affinities"("extensionId", "companyId");

-- AddForeignKey
ALTER TABLE "agent_company_scopes" ADD CONSTRAINT "agent_company_scopes_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "phone_extensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_company_scopes" ADD CONSTRAINT "agent_company_scopes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_ratings" ADD CONSTRAINT "call_ratings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_ratings" ADD CONSTRAINT "call_ratings_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "phone_extensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_affinities" ADD CONSTRAINT "agent_affinities_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "phone_extensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_affinities" ADD CONSTRAINT "agent_affinities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
