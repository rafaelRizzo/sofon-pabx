CREATE TABLE "dids" (
	"id" bigint PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"number" varchar(20) NOT NULL,
	"description" varchar(255),
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dids" ADD CONSTRAINT "dids_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dids_company_id_index" ON "dids" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "dids_number_index" ON "dids" USING btree ("number");--> statement-breakpoint
CREATE INDEX "dids_status_index" ON "dids" USING btree ("status");