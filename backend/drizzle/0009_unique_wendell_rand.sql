CREATE INDEX "companies_status_index" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "companies_name_index" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "plans_status_index" ON "plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "queue_members_queue_id_index" ON "queue_members" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "queue_members_extension_id_index" ON "queue_members" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "queues_company_id_index" ON "queues" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "queues_status_index" ON "queues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_index" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_index" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "trunks_company_id_index" ON "trunks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trunks_status_index" ON "trunks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_status_index" ON "users" USING btree ("status");--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_name_unique" UNIQUE("name");