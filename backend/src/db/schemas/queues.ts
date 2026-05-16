import {
    pgTable,
    bigint,
    varchar,
    text,
    integer,
    boolean,
    timestamp,
    uniqueIndex,
    index,
} from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { generateSnowflake } from '../../utils/generators/snowflake.generator'

export const queues = pgTable('queues', {
    id: bigint('id', { mode: 'bigint' })
        .primaryKey()
        .$defaultFn(() => generateSnowflake.generate()),

    company_id: bigint('company_id', { mode: 'bigint' })
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 })
        .notNull(),

    number: varchar('number', { length: 10 })
        .notNull(),

    account_code: varchar('account_code', { length: 20 })
        .notNull(),

    strategy: varchar('strategy', { length: 20 })
        .notNull()
        .default('ringall'),

    timeout: integer('timeout')
        .notNull()
        .default(15),

    maxlen: integer('maxlen')
        .default(0),

    musiconhold: varchar('musiconhold', { length: 255 }),

    announce: varchar('announce', { length: 255 }),

    joinempty: varchar('joinempty', { length: 10 })
        .default('yes'),

    leavewhenempty: varchar('leavewhenempty', { length: 10 })
        .default('no'),

    weight: integer('weight')
        .default(0),

    autopause: varchar('autopause', { length: 20 })
        .default('no'),

    announcefrequency: integer('announcefrequency'),

    announceholdtime: varchar('announceholdtime', { length: 10 }),

    context: varchar('context', { length: 100 })
        .default('from-queue'),

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
    uniqueIndex('queues_company_id_name_unique').on(table.company_id, table.name),
    uniqueIndex('queues_company_id_number_unique').on(table.company_id, table.number),
    uniqueIndex('queues_account_code_unique').on(table.account_code),
    index().on(table.company_id),
    index().on(table.status),
])
