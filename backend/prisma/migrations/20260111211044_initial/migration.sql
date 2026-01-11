-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'agent');

-- CreateEnum
CREATE TYPE "RecurrencyType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "IVROptionType" AS ENUM ('DIGIT', 'INPUT');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST');

-- CreateEnum
CREATE TYPE "TrunkType" AS ENUM ('SIP', 'PJSIP', 'IAX');

-- CreateEnum
CREATE TYPE "ExtensionType" AS ENUM ('SIP', 'PJSIP', 'IAX');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "token" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'agent',
    "status" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numberReceived" TEXT NOT NULL,
    "description" TEXT,
    "destinationApp" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audioId" TEXT,
    "destinationApp" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeconditions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trueDestinationApp" TEXT NOT NULL,
    "trueDestinationId" TEXT NOT NULL,
    "falseDestinationApp" TEXT NOT NULL,
    "falseDestinationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeconditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timerules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recurrencyType" "RecurrencyType" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "weekDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "monthDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "months" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "timeConditionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timerules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ivrs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audioId" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 5,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeoutDestinationApp" TEXT,
    "timeoutDestinationId" TEXT,
    "invalidDestinationApp" TEXT,
    "invalidDestinationId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ivrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ivr_options" (
    "id" TEXT NOT NULL,
    "type" "IVROptionType" NOT NULL DEFAULT 'DIGIT',
    "digit" TEXT,
    "minDigits" INTEGER DEFAULT 1,
    "maxDigits" INTEGER DEFAULT 20,
    "variableName" TEXT,
    "destinationApp" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "ivrId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ivr_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method" "HttpMethod" NOT NULL DEFAULT 'GET',
    "url" TEXT NOT NULL,
    "headers" JSONB,
    "body" JSONB,
    "params" JSONB,
    "timeout" INTEGER NOT NULL DEFAULT 5000,
    "responseMapping" JSONB,
    "successDestinationApp" TEXT,
    "successDestinationId" TEXT,
    "failureDestinationApp" TEXT,
    "failureDestinationId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extensions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "callerIdName" TEXT NOT NULL,
    "callerIdNum" TEXT NOT NULL,
    "description" TEXT,
    "typeExtension" "ExtensionType" NOT NULL DEFAULT 'SIP',
    "config" JSONB NOT NULL,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trunks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "typeTrunk" "TrunkType" NOT NULL DEFAULT 'SIP',
    "config" JSONB NOT NULL,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trunkId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_variables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variable" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "destinationApp" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "set_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "audios_companyId_idx" ON "audios"("companyId");

-- CreateIndex
CREATE INDEX "audios_companyId_createdAt_idx" ON "audios"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audios_companyId_name_key" ON "audios"("companyId", "name");

-- CreateIndex
CREATE INDEX "inbound_routes_companyId_idx" ON "inbound_routes"("companyId");

-- CreateIndex
CREATE INDEX "inbound_routes_companyId_createdAt_idx" ON "inbound_routes"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "inbound_routes_numberReceived_idx" ON "inbound_routes"("numberReceived");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_routes_companyId_name_key" ON "inbound_routes"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_routes_companyId_numberReceived_key" ON "inbound_routes"("companyId", "numberReceived");

-- CreateIndex
CREATE INDEX "announcements_companyId_idx" ON "announcements"("companyId");

-- CreateIndex
CREATE INDEX "announcements_companyId_createdAt_idx" ON "announcements"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "announcements_companyId_name_key" ON "announcements"("companyId", "name");

-- CreateIndex
CREATE INDEX "timeconditions_companyId_idx" ON "timeconditions"("companyId");

-- CreateIndex
CREATE INDEX "timeconditions_companyId_createdAt_idx" ON "timeconditions"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "timeconditions_companyId_name_key" ON "timeconditions"("companyId", "name");

-- CreateIndex
CREATE INDEX "timerules_timeConditionId_idx" ON "timerules"("timeConditionId");

-- CreateIndex
CREATE INDEX "timerules_companyId_idx" ON "timerules"("companyId");

-- CreateIndex
CREATE INDEX "timerules_companyId_timeConditionId_idx" ON "timerules"("companyId", "timeConditionId");

-- CreateIndex
CREATE INDEX "ivrs_companyId_idx" ON "ivrs"("companyId");

-- CreateIndex
CREATE INDEX "ivrs_companyId_createdAt_idx" ON "ivrs"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ivrs_companyId_name_key" ON "ivrs"("companyId", "name");

-- CreateIndex
CREATE INDEX "ivr_options_ivrId_idx" ON "ivr_options"("ivrId");

-- CreateIndex
CREATE INDEX "ivr_options_companyId_idx" ON "ivr_options"("companyId");

-- CreateIndex
CREATE INDEX "ivr_options_companyId_ivrId_idx" ON "ivr_options"("companyId", "ivrId");

-- CreateIndex
CREATE UNIQUE INDEX "ivr_options_ivrId_digit_key" ON "ivr_options"("ivrId", "digit");

-- CreateIndex
CREATE INDEX "api_requests_companyId_idx" ON "api_requests"("companyId");

-- CreateIndex
CREATE INDEX "api_requests_companyId_createdAt_idx" ON "api_requests"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_requests_companyId_name_key" ON "api_requests"("companyId", "name");

-- CreateIndex
CREATE INDEX "queues_companyId_idx" ON "queues"("companyId");

-- CreateIndex
CREATE INDEX "queues_companyId_createdAt_idx" ON "queues"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "queues_companyId_name_key" ON "queues"("companyId", "name");

-- CreateIndex
CREATE INDEX "extensions_companyId_idx" ON "extensions"("companyId");

-- CreateIndex
CREATE INDEX "extensions_companyId_createdAt_idx" ON "extensions"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_companyId_name_key" ON "extensions"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_companyId_callerIdNum_key" ON "extensions"("companyId", "callerIdNum");

-- CreateIndex
CREATE INDEX "trunks_companyId_idx" ON "trunks"("companyId");

-- CreateIndex
CREATE INDEX "trunks_companyId_createdAt_idx" ON "trunks"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "trunks_companyId_name_key" ON "trunks"("companyId", "name");

-- CreateIndex
CREATE INDEX "outbound_routes_companyId_idx" ON "outbound_routes"("companyId");

-- CreateIndex
CREATE INDEX "outbound_routes_companyId_createdAt_idx" ON "outbound_routes"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "outbound_routes_companyId_priority_idx" ON "outbound_routes"("companyId", "priority");

-- CreateIndex
CREATE INDEX "outbound_routes_trunkId_idx" ON "outbound_routes"("trunkId");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_routes_companyId_name_key" ON "outbound_routes"("companyId", "name");

-- CreateIndex
CREATE INDEX "set_variables_companyId_idx" ON "set_variables"("companyId");

-- CreateIndex
CREATE INDEX "set_variables_companyId_createdAt_idx" ON "set_variables"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "set_variables_companyId_name_key" ON "set_variables"("companyId", "name");

-- AddForeignKey
ALTER TABLE "audios" ADD CONSTRAINT "audios_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_routes" ADD CONSTRAINT "inbound_routes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeconditions" ADD CONSTRAINT "timeconditions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timerules" ADD CONSTRAINT "timerules_timeConditionId_fkey" FOREIGN KEY ("timeConditionId") REFERENCES "timeconditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timerules" ADD CONSTRAINT "timerules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivrs" ADD CONSTRAINT "ivrs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivr_options" ADD CONSTRAINT "ivr_options_ivrId_fkey" FOREIGN KEY ("ivrId") REFERENCES "ivrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivr_options" ADD CONSTRAINT "ivr_options_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trunks" ADD CONSTRAINT "trunks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_routes" ADD CONSTRAINT "outbound_routes_trunkId_fkey" FOREIGN KEY ("trunkId") REFERENCES "trunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_routes" ADD CONSTRAINT "outbound_routes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_variables" ADD CONSTRAINT "set_variables_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
