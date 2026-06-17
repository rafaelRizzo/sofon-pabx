-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "doc" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dids" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "webhookSlug" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "token" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_companies" (
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "user_companies_pkey" PRIMARY KEY ("userId","companyId")
);

-- CreateTable
CREATE TABLE "extensions" (
    "id" BIGSERIAL NOT NULL,
    "context" VARCHAR(40) NOT NULL DEFAULT 'ramais',
    "exten" VARCHAR(40) NOT NULL,
    "priority" INTEGER NOT NULL,
    "app" VARCHAR(40) NOT NULL,
    "appdata" VARCHAR(256),

    CONSTRAINT "extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ps_aors" (
    "id" VARCHAR(40) NOT NULL,
    "contact" VARCHAR(255),
    "default_expiration" INTEGER DEFAULT 3600,
    "max_contacts" INTEGER DEFAULT 1,
    "minimum_expiration" INTEGER DEFAULT 60,
    "maximum_expiration" INTEGER DEFAULT 7200,
    "remove_existing" BOOLEAN DEFAULT true,
    "qualify_frequency" INTEGER DEFAULT 60,
    "qualify_timeout" DOUBLE PRECISION DEFAULT 3.0,
    "authenticate_qualify" BOOLEAN DEFAULT false,
    "outbound_proxy" VARCHAR(40),
    "support_path" BOOLEAN DEFAULT false,
    "mailboxes" VARCHAR(80)
);

-- CreateTable
CREATE TABLE "ps_auths" (
    "id" VARCHAR(40) NOT NULL,
    "auth_type" VARCHAR(40) DEFAULT 'userpass',
    "password" VARCHAR(80),
    "username" VARCHAR(40),
    "realm" VARCHAR(40),
    "md5_cred" VARCHAR(40),
    "nonce_lifetime" INTEGER
);

-- CreateTable
CREATE TABLE "ps_contacts" (
    "id" VARCHAR(255) NOT NULL,
    "uri" VARCHAR(255),
    "expiration_time" BIGINT,
    "qualify_frequency" INTEGER,
    "outbound_proxy" VARCHAR(40),
    "path" TEXT,
    "user_agent" VARCHAR(255),
    "qualify_timeout" DOUBLE PRECISION,
    "reg_server" VARCHAR(20),
    "authenticate_qualify" BOOLEAN,
    "via_addr" VARCHAR(40),
    "via_port" INTEGER,
    "call_id" VARCHAR(255),
    "endpoint" VARCHAR(40),
    "prune_on_boot" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "ps_endpoints" (
    "id" VARCHAR(40) NOT NULL,
    "transport" VARCHAR(40),
    "aors" VARCHAR(200),
    "auth" VARCHAR(200),
    "context" VARCHAR(40) DEFAULT 'ramais',
    "disallow" VARCHAR(200) DEFAULT 'all',
    "allow" VARCHAR(200) DEFAULT 'ulaw,alaw',
    "direct_media" BOOLEAN DEFAULT false,
    "dtmf_mode" VARCHAR(40) DEFAULT 'rfc4733',
    "force_rport" BOOLEAN DEFAULT true,
    "ice_support" BOOLEAN DEFAULT false,
    "rewrite_contact" BOOLEAN DEFAULT false,
    "rtp_symmetric" BOOLEAN DEFAULT false,
    "send_diversion" BOOLEAN DEFAULT true,
    "timers" VARCHAR(40) DEFAULT 'yes',
    "timers_min_se" INTEGER DEFAULT 90,
    "timers_sess_expires" INTEGER DEFAULT 1800,
    "callerid" VARCHAR(40),
    "language" VARCHAR(10) DEFAULT 'pt_BR',
    "one_touch_recording" BOOLEAN DEFAULT false,
    "allow_transfer" BOOLEAN DEFAULT true,
    "allow_subscribe" BOOLEAN DEFAULT true,
    "from_user" VARCHAR(40),
    "from_domain" VARCHAR(40),
    "outbound_proxy" VARCHAR(40),
    "mailboxes" VARCHAR(40),
    "moh_suggest" VARCHAR(40) DEFAULT 'default',
    "100rel" VARCHAR(40) DEFAULT 'yes'
);

-- CreateTable
CREATE TABLE "sip_peers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "host" VARCHAR(40) DEFAULT 'dynamic',
    "nat" VARCHAR(40) DEFAULT 'force_rport,comedia',
    "type" VARCHAR(10) DEFAULT 'friend',
    "context" VARCHAR(40) DEFAULT 'ramais',
    "dtmfmode" VARCHAR(10) DEFAULT 'rfc2833',
    "language" VARCHAR(10) DEFAULT 'pt_BR',
    "port" VARCHAR(6) DEFAULT '5060',
    "qualify" VARCHAR(10) DEFAULT 'yes',
    "secret" VARCHAR(80),
    "disallow" VARCHAR(100) DEFAULT 'all',
    "allow" VARCHAR(100) DEFAULT 'ulaw,alaw',
    "regseconds" BIGINT DEFAULT 0,
    "ipaddr" VARCHAR(40),
    "fullcontact" VARCHAR(80),
    "lastms" INTEGER DEFAULT 0,

    CONSTRAINT "sip_peers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voicemail_users" (
    "uniqueid" SERIAL NOT NULL,
    "context" VARCHAR(80) DEFAULT 'default',
    "mailbox" VARCHAR(80) NOT NULL,
    "password" VARCHAR(80) DEFAULT '0000',
    "fullname" VARCHAR(80),
    "email" VARCHAR(80),
    "attach" VARCHAR(4) DEFAULT 'yes',
    "delete_vm" VARCHAR(4) DEFAULT 'no',
    "stamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voicemail_users_pkey" PRIMARY KEY ("uniqueid")
);

-- CreateIndex
CREATE UNIQUE INDEX "dids_number_companyId_key" ON "dids"("number", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "users_webhookSlug_key" ON "users"("webhookSlug");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_token_key" ON "users"("token");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_context_exten_priority_key" ON "extensions"("context", "exten", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ps_aors_id_key" ON "ps_aors"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ps_auths_id_key" ON "ps_auths"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ps_contacts_id_key" ON "ps_contacts"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ps_endpoints_id_key" ON "ps_endpoints"("id");

-- CreateIndex
CREATE UNIQUE INDEX "sip_peers_name_key" ON "sip_peers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "voicemail_users_context_mailbox_key" ON "voicemail_users"("context", "mailbox");

-- AddForeignKey
ALTER TABLE "dids" ADD CONSTRAINT "dids_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
