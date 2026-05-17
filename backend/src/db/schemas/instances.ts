import {
    pgTable,
    bigint,
    varchar,
    jsonb,
    timestamp,
    index,
    uniqueIndex,
    foreignKey,
} from 'drizzle-orm/pg-core'
import { generateSnowflake } from '../../utils/generators/snowflake.generator'
import { companies } from './companies'

export const instances = pgTable('instances', {
    id: bigint('id', { mode: 'bigint' })
        .primaryKey()
        .$defaultFn(() => generateSnowflake.generate()),

    company_id: bigint('company_id', { mode: 'bigint' })
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 })
        .notNull(),

    erp_type: varchar('erp_type')
        .notNull(),

    url: varchar('url', { length: 500 })
        .notNull(),

    config: jsonb('config')
        .notNull()
        .default({}),

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
    uniqueIndex().on(table.company_id, table.name),
    index().on(table.company_id),
    index().on(table.erp_type),
    index().on(table.status),
])
