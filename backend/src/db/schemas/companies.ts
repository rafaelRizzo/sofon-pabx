import {
    pgTable,
    uuid,
    varchar,
    timestamp,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const companies = pgTable('companies', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    name: varchar('name', { length: 255 })
        .unique()
        .notNull(),

    status: varchar('status')
        .notNull()
        .default('active'),

    created_at: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),

    updated_at: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date())
})