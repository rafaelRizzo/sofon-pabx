CREATE TABLE "companies" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"prefix" varchar(10) NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'guest' NOT NULL,
	"obs" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
CREATE TABLE "extensions" (
	"id" bigint PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"number" varchar(10) NOT NULL,
	"account_code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"secret" varchar(255) NOT NULL,
	"host" varchar(255) DEFAULT 'dynamic' NOT NULL,
	"type" varchar(20) DEFAULT 'friend' NOT NULL,
	"nat" varchar(10) DEFAULT 'yes' NOT NULL,
	"qualify" varchar(10) DEFAULT 'yes' NOT NULL,
	"dtmfmode" varchar(10) DEFAULT 'rfc2833' NOT NULL,
	"context" varchar(100) DEFAULT 'from-internal' NOT NULL,
	"codecs" jsonb DEFAULT '["ulaw","alaw"]'::jsonb,
	"disallow" varchar(255),
	"insecure" varchar(100) DEFAULT 'port,invite',
	"directmedia" boolean DEFAULT false,
	"callgroup" varchar(100),
	"pickupgroup" varchar(100),
	"voicemail" varchar(20),
	"mailbox" varchar(100),
	"username" varchar(100),
	"obs" varchar(1000),
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "queue_members" (
	"id" bigint PRIMARY KEY NOT NULL,
	"queue_id" bigint NOT NULL,
	"extension_id" bigint NOT NULL,
	"penalty" integer DEFAULT 0,
	"paused" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" bigint PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
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
	"obs" varchar(1000),
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"token_jti" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_jti_unique" UNIQUE("token_jti")
);
--> statement-breakpoint
CREATE TABLE "trunks" (
	"id" bigint PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(20) DEFAULT 'sip' NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer DEFAULT 5060 NOT NULL,
	"username" varchar(255),
	"password" varchar(255),
	"fromuser" varchar(255),
	"fromdomain" varchar(255),
	"context" varchar(100) DEFAULT 'from-trunk' NOT NULL,
	"disallow" varchar(255),
	"insecure" varchar(100) DEFAULT 'port,invite',
	"nat" varchar(10) DEFAULT 'yes' NOT NULL,
	"qualify" varchar(10) DEFAULT 'yes' NOT NULL,
	"directmedia" boolean DEFAULT false,
	"send_register" boolean DEFAULT false NOT NULL,
	"register_string" text,
	"outbound_proxy" varchar(255),
	"codecs" jsonb DEFAULT '["ulaw","alaw"]'::jsonb,
	"obs" varchar(1000),
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY NOT NULL,
	"webhook_slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"token" text,
	"role" varchar DEFAULT 'user' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_webhook_slug_unique" UNIQUE("webhook_slug"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_members" ADD CONSTRAINT "queue_members_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_members" ADD CONSTRAINT "queue_members_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trunks" ADD CONSTRAINT "trunks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_status_index" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "companies_name_index" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "extensions_account_code_index" ON "extensions" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "extensions_company_id_number_index" ON "extensions" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "extensions_number_index" ON "extensions" USING btree ("number");--> statement-breakpoint
CREATE INDEX "plans_status_index" ON "plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_members_queue_extension_unique" ON "queue_members" USING btree ("queue_id","extension_id");--> statement-breakpoint
CREATE INDEX "queue_members_queue_id_index" ON "queue_members" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "queue_members_extension_id_index" ON "queue_members" USING btree ("extension_id");--> statement-breakpoint
CREATE UNIQUE INDEX "queues_company_id_name_unique" ON "queues" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "queues_company_id_number_unique" ON "queues" USING btree ("company_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "queues_account_code_unique" ON "queues" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "queues_company_id_index" ON "queues" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "queues_status_index" ON "queues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_index" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_index" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trunks_company_id_name_unique" ON "trunks" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "trunks_company_id_index" ON "trunks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trunks_status_index" ON "trunks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_status_index" ON "users" USING btree ("status");