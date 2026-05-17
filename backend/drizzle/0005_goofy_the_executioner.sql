ALTER TABLE "dids" DROP CONSTRAINT "dids_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "instances" DROP CONSTRAINT "instances_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "dids" ADD CONSTRAINT "dids_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;