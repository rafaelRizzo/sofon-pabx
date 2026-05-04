CREATE TABLE "trunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(20) DEFAULT 'sip' NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer DEFAULT 5060 NOT NULL,
	"username" varchar(255),
	"password" varchar(255),
	"fromuser" varchar(255),
	"fromdomain" varchar(255),
	"context" varchar(100) DEFAULT 'from-trunk' NOT NULL,
	"allow" varchar(255) DEFAULT '!all,ulaw,alaw',
	"disallow" varchar(255),
	"insecure" varchar(100) DEFAULT 'port,invite',
	"nat" varchar(10) DEFAULT 'yes' NOT NULL,
	"qualify" varchar(10) DEFAULT 'yes' NOT NULL,
	"directmedia" boolean DEFAULT false,
	"send_register" boolean DEFAULT false NOT NULL,
	"register_string" text,
	"outbound_proxy" varchar(255),
	"codecs" jsonb DEFAULT '["ulaw","alaw"]'::jsonb,
	"metadata" jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trunks" ADD CONSTRAINT "trunks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trunks_company_id_name_unique" ON "trunks" USING btree ("company_id","name");