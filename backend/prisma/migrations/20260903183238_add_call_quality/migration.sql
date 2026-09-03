-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "call_quality" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "trunkId" TEXT NOT NULL,
    "uniqueid" TEXT NOT NULL,
    "linkedid" TEXT,
    "callerNum" TEXT,
    "channel" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "avgRxJitterUnits" DOUBLE PRECISION,
    "avgRxLostPct" DOUBLE PRECISION,
    "rxSamples" INTEGER NOT NULL,
    "avgTxJitterUnits" DOUBLE PRECISION,
    "avgTxLostPct" DOUBLE PRECISION,
    "txSamples" INTEGER NOT NULL,
    "avgRttSeconds" DOUBLE PRECISION,
    "rttSamples" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_quality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_quality_uniqueid_key" ON "call_quality"("uniqueid");

-- CreateIndex
CREATE INDEX "call_quality_companyId_startAt_idx" ON "call_quality"("companyId", "startAt");

-- CreateIndex
CREATE INDEX "call_quality_trunkId_startAt_idx" ON "call_quality"("trunkId", "startAt");

-- AddForeignKey
ALTER TABLE "call_quality" ADD CONSTRAINT "call_quality_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_quality" ADD CONSTRAINT "call_quality_trunkId_fkey" FOREIGN KEY ("trunkId") REFERENCES "trunks_app"("id") ON DELETE CASCADE ON UPDATE CASCADE;
