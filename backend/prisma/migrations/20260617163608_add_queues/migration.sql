-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- CreateTable
CREATE TABLE "queues_app" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "companyId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'ringall',
    "musicOnHold" TEXT NOT NULL DEFAULT 'default',
    "timeout" INTEGER NOT NULL DEFAULT 15,
    "retry" INTEGER NOT NULL DEFAULT 5,
    "maxLen" INTEGER NOT NULL DEFAULT 0,
    "wrapupTime" INTEGER NOT NULL DEFAULT 0,
    "announce" TEXT,
    "announceFrequency" INTEGER NOT NULL DEFAULT 0,
    "joinEmpty" BOOLEAN NOT NULL DEFAULT true,
    "leaveWhenEmpty" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queues_app_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_members_app" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "penalty" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_members_app_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queues" (
    "name" VARCHAR(128) NOT NULL,
    "strategy" VARCHAR(40) DEFAULT 'ringall',
    "musiconhold" VARCHAR(128) DEFAULT 'default',
    "timeout" INTEGER DEFAULT 15,
    "retry" INTEGER DEFAULT 5,
    "maxlen" INTEGER DEFAULT 0,
    "wrapuptime" INTEGER DEFAULT 0,
    "announce" VARCHAR(128),
    "announce-frequency" INTEGER DEFAULT 0,
    "joinempty" VARCHAR(40) DEFAULT 'yes',
    "leavewhenempty" VARCHAR(40) DEFAULT 'no',
    "weight" INTEGER DEFAULT 0,
    "reportholdtime" VARCHAR(10) DEFAULT 'no',
    "ringinuse" VARCHAR(10) DEFAULT 'yes',

    CONSTRAINT "queues_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "queue_members" (
    "uniqueid" BIGSERIAL NOT NULL,
    "queue_name" VARCHAR(128) NOT NULL,
    "interface" VARCHAR(128) NOT NULL,
    "membername" VARCHAR(80),
    "state_interface" VARCHAR(128),
    "penalty" INTEGER DEFAULT 0,
    "paused" INTEGER DEFAULT 0,
    "wrapuptime" INTEGER DEFAULT 0,

    CONSTRAINT "queue_members_pkey" PRIMARY KEY ("uniqueid")
);

-- CreateIndex
CREATE INDEX "queues_app_companyId_idx" ON "queues_app"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "queues_app_name_companyId_key" ON "queues_app"("name", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "queue_members_app_queueId_extensionId_key" ON "queue_members_app"("queueId", "extensionId");

-- CreateIndex
CREATE UNIQUE INDEX "queue_members_queue_name_interface_key" ON "queue_members"("queue_name", "interface");

-- AddForeignKey
ALTER TABLE "queues_app" ADD CONSTRAINT "queues_app_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_members_app" ADD CONSTRAINT "queue_members_app_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues_app"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_members_app" ADD CONSTRAINT "queue_members_app_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "phone_extensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
