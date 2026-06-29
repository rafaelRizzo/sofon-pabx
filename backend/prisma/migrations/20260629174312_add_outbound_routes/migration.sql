-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "outbound_routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_dial_patterns" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "pattern" VARCHAR(40) NOT NULL,
    "prepend" VARCHAR(40),
    "prefix" VARCHAR(40),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_dial_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_route_trunks" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "trunkId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outbound_route_trunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_route_extensions" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,

    CONSTRAINT "outbound_route_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_routes_companyId_idx" ON "outbound_routes"("companyId");

-- CreateIndex
CREATE INDEX "outbound_dial_patterns_routeId_idx" ON "outbound_dial_patterns"("routeId");

-- CreateIndex
CREATE INDEX "outbound_route_trunks_routeId_idx" ON "outbound_route_trunks"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_route_trunks_routeId_trunkId_key" ON "outbound_route_trunks"("routeId", "trunkId");

-- CreateIndex
CREATE INDEX "outbound_route_extensions_routeId_idx" ON "outbound_route_extensions"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_route_extensions_routeId_extensionId_key" ON "outbound_route_extensions"("routeId", "extensionId");

-- AddForeignKey
ALTER TABLE "outbound_routes" ADD CONSTRAINT "outbound_routes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_dial_patterns" ADD CONSTRAINT "outbound_dial_patterns_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "outbound_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_route_trunks" ADD CONSTRAINT "outbound_route_trunks_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "outbound_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_route_trunks" ADD CONSTRAINT "outbound_route_trunks_trunkId_fkey" FOREIGN KEY ("trunkId") REFERENCES "trunks_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_route_extensions" ADD CONSTRAINT "outbound_route_extensions_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "outbound_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_route_extensions" ADD CONSTRAINT "outbound_route_extensions_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "phone_extensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
