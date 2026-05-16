import {
    pgTable,
    bigint,
    varchar,
    text,
    timestamp,
    jsonb,
    index,
} from 'drizzle-orm/pg-core'
import { generateSnowflake } from '../../utils/generators/snowflake.generator'

export const companies = pgTable('companies', {
    id: bigint('id', { mode: 'bigint' })
        .primaryKey()
        .$defaultFn(() => generateSnowflake.generate()),

    name: varchar('name', { length: 255 })
        .notNull(),

    prefix: varchar('prefix', { length: 10 })
        .notNull()
        .unique(),

    description: text('description'),

    status: varchar('status')
        .notNull()
        .default('guest'),

    obs: varchar('obs', { length: 1000 }),

    created_at: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),

    updated_at: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    index().on(table.status),
    index().on(table.name),
])
