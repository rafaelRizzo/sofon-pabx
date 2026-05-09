import { sql } from 'drizzle-orm'
import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    jsonb,
    index,
} from 'drizzle-orm/pg-core'

export const companies = pgTable('companies', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    name: varchar('name', { length: 255 })
        .notNull(),

    prefix: varchar('prefix', { length: 10 })
        .notNull()
        .unique(),

    description: text('description'),

    status: varchar('status')
        .notNull()
        .default('guest'),

    metadata: jsonb('metadata'),

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
