CREATE TABLE "queues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"number" varchar(10) NOT NULL,
	"account_code" varchar(20) NOT NULL,
	"strategy" varchar(20) DEFAULT 'ringall' NOT NULL,
	"timeout" integer DEFAULT 15 NOT NULL,
	"maxlen" integer DEFAULT 0,
	"musiconhold" varchar(255),
	"announce" varchar(255),
	"joinempty" varchar(10) DEFAULT 'yes',
	"leavewhenempty" varchar(10) DEFAULT 'no',
	"weight" integer DEFAULT 0,
	"autopause" varchar(20) DEFAULT 'no',
	"announcefrequency" integer,
	"announceholdtime" varchar(10),
	"context" varchar(100) DEFAULT 'from-queue',
	"metadata" jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "queues_company_id_name_unique" ON "queues" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "queues_company_id_number_unique" ON "queues" USING btree ("company_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "queues_account_code_unique" ON "queues" USING btree ("account_code");