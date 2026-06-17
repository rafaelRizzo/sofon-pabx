-- CreateTable
CREATE TABLE "phone_extensions" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'ramais',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "phone_extensions_number_key" ON "phone_extensions"("number");

-- CreateIndex
CREATE UNIQUE INDEX "phone_extensions_alias_companyId_key" ON "phone_extensions"("alias", "companyId");

-- AddForeignKey
ALTER TABLE "phone_extensions" ADD CONSTRAINT "phone_extensions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
