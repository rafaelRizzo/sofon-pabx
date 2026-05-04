ALTER TABLE "extensions" ADD COLUMN "company_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "number" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "account_code" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "secret" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "host" varchar(255) DEFAULT 'dynamic' NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "type" varchar(20) DEFAULT 'friend' NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "send_register" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "register_string" text;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "nat" varchar(10) DEFAULT 'yes' NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "qualify" varchar(10) DEFAULT 'yes' NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "dtmfmode" varchar(10) DEFAULT 'rfc2833' NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "context" varchar(100) DEFAULT 'from-internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "codecs" jsonb DEFAULT '["ulaw","alaw"]'::jsonb;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "allow" varchar(255) DEFAULT '!all,ulaw,alaw';--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "disallow" varchar(255);--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "insecure" varchar(100) DEFAULT 'port,invite';--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "directmedia" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "callgroup" varchar(100);--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "pickupgroup" varchar(100);--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "voicemail" varchar(20);--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "mailbox" varchar(100);--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "username" varchar(100);--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "status" varchar DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;