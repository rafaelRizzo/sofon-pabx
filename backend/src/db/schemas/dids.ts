import {
    pgTable,
    bigint,
    varchar,
    timestamp,
    index,
    foreignKey,
    uniqueIndex,
} from 'drizzle-orm/pg-core'
import { generateSnowflake } from '../../utils/generators/snowflake.generator'
import { companies } from './companies'

export const dids = pgTable('dids', {
    id: bigint('id', { mode: 'bigint' })
        .primaryKey()
        .$defaultFn(() => generateSnowflake.generate()),

    company_id: bigint('company_id', { mode: 'bigint' })
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),

    number: varchar('number', { length: 20 })
        .notNull(),

    description: varchar('description', { length: 255 }),

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
    index().on(table.company_id),
    index().on(table.number),
    index().on(table.status),
    uniqueIndex().on(table.company_id, table.number),
])
