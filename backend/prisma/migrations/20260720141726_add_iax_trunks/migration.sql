-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "asteriskId" SET DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10);

-- AlterTable
ALTER TABLE "trunks_app" ADD COLUMN     "encryption" BOOLEAN,
ADD COLUMN     "jitterbuffer" BOOLEAN,
ADD COLUMN     "qualify" VARCHAR(10),
ADD COLUMN     "transfer" VARCHAR(10),
ADD COLUMN     "trunkMode" BOOLEAN,
ADD COLUMN     "type" VARCHAR(10) NOT NULL DEFAULT 'pjsip';

-- CreateTable
CREATE TABLE "iax_friends" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "type" VARCHAR(10) DEFAULT 'friend',
    "host" VARCHAR(40) DEFAULT 'dynamic',
    "secret" VARCHAR(80),
    "context" VARCHAR(40) DEFAULT 'ramais',
    "permit" VARCHAR(95),
    "deny" VARCHAR(95),
    "disallow" VARCHAR(200) DEFAULT 'all',
    "allow" VARCHAR(200) DEFAULT 'ulaw,alaw',
    "callerid" VARCHAR(40),
    "accountcode" VARCHAR(40),
    "qualify" VARCHAR(10) DEFAULT 'yes',
    "trunk" VARCHAR(10) DEFAULT 'no',
    "encryption" VARCHAR(10) DEFAULT 'no',
    "transfer" VARCHAR(10) DEFAULT 'mediaonly',
    "jitterbuffer" VARCHAR(10) DEFAULT 'no',
    "requirecalltoken" VARCHAR(10) DEFAULT 'yes',
    "setvar" VARCHAR(200),
    "regseconds" BIGINT DEFAULT 0,
    "ipaddr" VARCHAR(45),
    "port" VARCHAR(6),

    CONSTRAINT "iax_friends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iax_friends_name_key" ON "iax_friends"("name");
