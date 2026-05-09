import { sql } from 'drizzle-orm'
import {
    pgTable,
    uuid,
    varchar,
    text,
    numeric,
    jsonb,
    timestamp,
    uniqueIndex,
    index,
} from 'drizzle-orm/pg-core'

export const plans = pgTable('plans', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    name: varchar('name', { length: 255 })
        .notNull()
        .unique(),

    description: text('description'),

    price: numeric('price', { precision: 10, scale: 2 })
        .notNull(),

    features: jsonb('features')
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
    index().on(table.status),
])
