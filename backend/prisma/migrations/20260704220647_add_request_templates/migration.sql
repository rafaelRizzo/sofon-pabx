-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "request_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "method" VARCHAR(10) NOT NULL DEFAULT 'GET',
    "url" TEXT NOT NULL,
    "headers" JSONB,
    "body" JSONB,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "variableMappings" JSONB NOT NULL DEFAULT '[]',
    "onSuccess" JSONB,
    "onError" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "request_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_templates_companyId_idx" ON "request_templates"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "request_templates_name_companyId_key" ON "request_templates"("name", "companyId");

-- AddForeignKey
ALTER TABLE "request_templates" ADD CONSTRAINT "request_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
