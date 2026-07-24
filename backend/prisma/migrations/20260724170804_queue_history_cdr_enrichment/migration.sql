-- AlterTable
ALTER TABLE "cdr" ADD COLUMN     "dialed_number" VARCHAR(80),
ADD COLUMN     "direction" VARCHAR(10),
ADD COLUMN     "hangup_cause" VARCHAR(45),
ADD COLUMN     "linkedid" VARCHAR(150),
ADD COLUMN     "origin_extension" VARCHAR(40),
ADD COLUMN     "recording_file" VARCHAR(255),
ADD COLUMN     "sequence" INTEGER,
ADD COLUMN     "trunk_id" VARCHAR(40);

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "queue_calls" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "queueId" TEXT,
    "queueName" VARCHAR(160) NOT NULL,
    "callerUniqueid" VARCHAR(150) NOT NULL,
    "linkedid" VARCHAR(150),
    "src" VARCHAR(80),
    "enteredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "outcome" VARCHAR(20),
    "exitReason" VARCHAR(40),
    "agentExtensionId" TEXT,
    "agentInterface" VARCHAR(80),
    "waitSeconds" INTEGER,
    "ringSeconds" INTEGER,
    "talkSeconds" INTEGER,
    "initialPosition" INTEGER,
    "finalPosition" INTEGER,
    "recordingFile" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "queue_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "queue_calls_companyId_enteredAt_idx" ON "queue_calls"("companyId", "enteredAt" DESC);

-- CreateIndex
CREATE INDEX "queue_calls_queueName_enteredAt_idx" ON "queue_calls"("queueName", "enteredAt" DESC);

-- CreateIndex
CREATE INDEX "queue_calls_outcome_enteredAt_idx" ON "queue_calls"("outcome", "enteredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "queue_calls_callerUniqueid_queueName_key" ON "queue_calls"("callerUniqueid", "queueName");

-- CreateIndex
CREATE INDEX "cdr_linkedid_idx" ON "cdr"("linkedid");

-- CreateIndex
CREATE INDEX "cdr_direction_start_idx" ON "cdr"("direction", "start");

-- CreateIndex
CREATE INDEX "cdr_trunk_id_start_idx" ON "cdr"("trunk_id", "start");

-- AddForeignKey
ALTER TABLE "queue_calls" ADD CONSTRAINT "queue_calls_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_calls" ADD CONSTRAINT "queue_calls_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_calls" ADD CONSTRAINT "queue_calls_agentExtensionId_fkey" FOREIGN KEY ("agentExtensionId") REFERENCES "phone_extensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
