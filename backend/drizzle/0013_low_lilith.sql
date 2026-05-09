ALTER TABLE "companies" ADD COLUMN "obs" varchar(1000);--> statement-breakpoint
ALTER TABLE "queues" ADD COLUMN "obs" varchar(1000);--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "metadata";