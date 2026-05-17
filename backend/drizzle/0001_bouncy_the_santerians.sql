CREATE TABLE "instances" (
	"id" bigint PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"erp_type" varchar NOT NULL,
	"url" varchar(500) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instances_company_id_index" ON "instances" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "instances_erp_type_index" ON "instances" USING btree ("erp_type");--> statement-breakpoint
CREATE INDEX "instances_status_index" ON "instances" USING btree ("status");