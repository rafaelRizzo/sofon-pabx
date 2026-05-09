CREATE INDEX "extensions_account_code_index" ON "extensions" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "extensions_company_id_number_index" ON "extensions" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "extensions_number_index" ON "extensions" USING btree ("number");