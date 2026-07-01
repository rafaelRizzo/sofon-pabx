-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "inbound_routes" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "didId" TEXT NOT NULL,
    "trunkId" TEXT NOT NULL,
    "destination" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inbound_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_routes_companyId_idx" ON "inbound_routes"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_routes_trunkId_didId_key" ON "inbound_routes"("trunkId", "didId");

-- AddForeignKey
ALTER TABLE "inbound_routes" ADD CONSTRAINT "inbound_routes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_routes" ADD CONSTRAINT "inbound_routes_didId_fkey" FOREIGN KEY ("didId") REFERENCES "dids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_routes" ADD CONSTRAINT "inbound_routes_trunkId_fkey" FOREIGN KEY ("trunkId") REFERENCES "trunks_app"("id") ON DELETE CASCADE ON UPDATE CASCADE;
