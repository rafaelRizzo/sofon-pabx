-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "ps_endpoints" ADD COLUMN     "accountcode" VARCHAR(40);

-- CreateTable
CREATE TABLE "cdr" (
    "id" BIGSERIAL NOT NULL,
    "src" VARCHAR(80),
    "dst" VARCHAR(80),
    "dcontext" VARCHAR(80),
    "clid" VARCHAR(80),
    "channel" VARCHAR(80),
    "dstchannel" VARCHAR(80),
    "lastapp" VARCHAR(80),
    "lastdata" VARCHAR(200),
    "start" TIMESTAMP(3),
    "answer" TIMESTAMP(3),
    "end" TIMESTAMP(3),
    "duration" INTEGER,
    "billsec" INTEGER,
    "disposition" VARCHAR(45),
    "amaflags" INTEGER,
    "accountcode" VARCHAR(80),
    "uniqueid" VARCHAR(150),

    CONSTRAINT "cdr_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cdr_start_idx" ON "cdr"("start");

-- CreateIndex
CREATE INDEX "cdr_accountcode_idx" ON "cdr"("accountcode");
