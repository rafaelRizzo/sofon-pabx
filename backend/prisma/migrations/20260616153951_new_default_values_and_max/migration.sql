-- AlterTable
ALTER TABLE "sip_peers" ALTER COLUMN "port" SET DEFAULT '5062',
ALTER COLUMN "allow" SET DEFAULT 'ulaw,alaw,g729';
