import {
    pgTable,
    bigint,
    varchar,
    text,
    integer,
    boolean,
    timestamp,
    jsonb,
    uniqueIndex,
    index,
} from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { generateSnowflake } from '../../utils/generators/snowflake.generator'

export const trunks = pgTable('trunks', {
    id: bigint('id', { mode: 'bigint' })
        .primaryKey()
        .$defaultFn(() => generateSnowflake.generate()),

    company_id: bigint('company_id', { mode: 'bigint' })
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 })
        .notNull(),

    type: varchar('type', { length: 20 })
        .notNull()
        .default('sip'),

    host: varchar('host', { length: 255 })
        .notNull(),

    port: integer('port')
        .notNull()
        .default(5060),

    username: varchar('username', { length: 255 }),

    password: varchar('password', { length: 255 }),

    fromuser: varchar('fromuser', { length: 255 }),

    fromdomain: varchar('fromdomain', { length: 255 }),

    context: varchar('context', { length: 100 })
        .notNull()
        .default('from-trunk'),

    disallow: varchar('disallow', { length: 255 }),

    insecure: varchar('insecure', { length: 100 })
        .default('port,invite'),

    nat: varchar('nat', { length: 10 })
        .notNull()
        .default('yes'),

    qualify: varchar('qualify', { length: 10 })
        .notNull()
        .default('yes'),

    directmedia: boolean('directmedia')
        .default(false),

    send_register: boolean('send_register')
        .notNull()
        .default(false),

    register_string: text('register_string'),

    outbound_proxy: varchar('outbound_proxy', { length: 255 }),

    codecs: jsonb('codecs')
        .default(['ulaw', 'alaw']),

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
    uniqueIndex('trunks_company_id_name_unique').on(table.company_id, table.name),
    index().on(table.company_id),
    index().on(table.status),
])
