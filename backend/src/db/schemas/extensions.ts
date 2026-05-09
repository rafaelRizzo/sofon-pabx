import { sql } from 'drizzle-orm'
import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    timestamp,
    jsonb,
    index,
} from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const extensions = pgTable('extensions', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    company_id: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),

    number: varchar('number', { length: 10 })
        .notNull(),

    account_code: varchar('account_code', { length: 20 })
        .notNull(),

    name: varchar('name', { length: 255 })
        .notNull(),

    secret: varchar('secret', { length: 255 })
        .notNull(),

    host: varchar('host', { length: 255 })
        .notNull()
        .default('dynamic'),

    type: varchar('type', { length: 20 })
        .notNull()
        .default('friend'),

    nat: varchar('nat', { length: 10 })
        .notNull()
        .default('yes'),

    qualify: varchar('qualify', { length: 10 })
        .notNull()
        .default('yes'),

    dtmfmode: varchar('dtmfmode', { length: 10 })
        .notNull()
        .default('rfc2833'),

    context: varchar('context', { length: 100 })
        .notNull()
        .default('from-internal'),

    codecs: jsonb('codecs')
        .default(['ulaw', 'alaw']),

    disallow: varchar('disallow', { length: 255 }),

    insecure: varchar('insecure', { length: 100 })
        .default('port,invite'),

    directmedia: boolean('directmedia')
        .default(false),

    callgroup: varchar('callgroup', { length: 100 }),

    pickupgroup: varchar('pickupgroup', { length: 100 }),

    voicemail: varchar('voicemail', { length: 20 }),

    mailbox: varchar('mailbox', { length: 100 }),

    username: varchar('username', { length: 100 }),

    obs: varchar('obs', { length: 1000 }),

    status: varchar('status')
        .notNull()
        .default('active'),

    created_at: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),

    updated_at: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    index().on(table.account_code),
    index().on(table.company_id, table.number),
    index().on(table.number),
])
