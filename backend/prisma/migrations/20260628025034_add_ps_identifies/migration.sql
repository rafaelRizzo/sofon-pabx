-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "ps_identifies" (
    "id" VARCHAR(40) NOT NULL,
    "endpoint" VARCHAR(40),
    "match" VARCHAR(80),
    "srv_lookups" BOOLEAN DEFAULT false,

    CONSTRAINT "ps_identifies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ps_identifies_endpoint_idx" ON "ps_identifies"("endpoint");
