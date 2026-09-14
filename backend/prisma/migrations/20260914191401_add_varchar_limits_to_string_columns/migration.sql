/*
  Warnings:

  - You are about to alter the column `ttsVoiceId` on the `audios` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `actorName` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `ip` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(45)`.
  - You are about to alter the column `action` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `model` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(40)`.
  - You are about to alter the column `uniqueid` on the `call_quality` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `linkedid` on the `call_quality` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `callerNum` on the `call_quality` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(80)`.
  - You are about to alter the column `channel` on the `call_quality` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(80)`.
  - You are about to alter the column `name` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `doc` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `status` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `elevenLabsApiKey` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `number` on the `dids` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `status` on the `dids` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `sourceType` on the `flow_edges` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(40)`.
  - You are about to alter the column `slot` on the `flow_edges` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(40)`.
  - You are about to alter the column `targetType` on the `flow_edges` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(40)`.
  - You are about to alter the column `baseUrl` on the `integration_credentials` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `tokenCiphertext` on the `integration_credentials` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1024)`.
  - You are about to alter the column `tokenIv` on the `integration_credentials` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `tokenTag` on the `integration_credentials` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `type` on the `ivr_menus` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `name` on the `outbound_routes` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `alias` on the `phone_extensions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `number` on the `phone_extensions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `type` on the `phone_extensions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `name` on the `phone_extensions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `context` on the `phone_extensions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(40)`.
  - You are about to alter the column `path` on the `ps_contacts` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `recordingFile` on the `queue_calls` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `strategy` on the `queues_app` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `musicOnHold` on the `queues_app` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(128)`.
  - You are about to alter the column `url` on the `request_templates` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(2048)`.
  - You are about to alter the column `name` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `username` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `password` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `token` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1024)`.
  - You are about to alter the column `role` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `status` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `combinator` on the `variable_conditions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.

*/
-- AlterTable
ALTER TABLE "audios" ALTER COLUMN "ttsVoiceId" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "actorName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "ip" SET DATA TYPE VARCHAR(45),
ALTER COLUMN "action" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "model" SET DATA TYPE VARCHAR(40);

-- AlterTable
ALTER TABLE "call_quality" ALTER COLUMN "uniqueid" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "linkedid" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "callerNum" SET DATA TYPE VARCHAR(80),
ALTER COLUMN "channel" SET DATA TYPE VARCHAR(80);

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "doc" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "elevenLabsApiKey" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "dids" ALTER COLUMN "number" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "flow_edges" ALTER COLUMN "sourceType" SET DATA TYPE VARCHAR(40),
ALTER COLUMN "slot" SET DATA TYPE VARCHAR(40),
ALTER COLUMN "targetType" SET DATA TYPE VARCHAR(40);

-- AlterTable
ALTER TABLE "integration_credentials" ALTER COLUMN "baseUrl" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "tokenCiphertext" SET DATA TYPE VARCHAR(1024),
ALTER COLUMN "tokenIv" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "tokenTag" SET DATA TYPE VARCHAR(64);

-- AlterTable
ALTER TABLE "ivr_menus" ALTER COLUMN "type" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "outbound_routes" ALTER COLUMN "name" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "phone_extensions" ALTER COLUMN "alias" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "number" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "type" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "context" SET DATA TYPE VARCHAR(40);

-- AlterTable
ALTER TABLE "ps_contacts" ALTER COLUMN "path" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "queue_calls" ALTER COLUMN "recordingFile" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "queues_app" ALTER COLUMN "strategy" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "musicOnHold" SET DATA TYPE VARCHAR(128);

-- AlterTable
ALTER TABLE "request_templates" ALTER COLUMN "url" SET DATA TYPE VARCHAR(2048);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "username" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "password" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "token" SET DATA TYPE VARCHAR(1024),
ALTER COLUMN "role" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "variable_conditions" ALTER COLUMN "combinator" SET DATA TYPE VARCHAR(10);
