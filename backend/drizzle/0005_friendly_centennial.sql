CREATE TABLE "office_time" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"day_of_week" integer NOT NULL,
	"is_working_day" boolean DEFAULT true NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"lunch_start" time,
	"lunch_end" time,
	"obs" varchar(1024),
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instances" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "office_time" ADD CONSTRAINT "office_time_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "office_time_company_day_unique" ON "office_time" USING btree ("company_id","day_of_week");