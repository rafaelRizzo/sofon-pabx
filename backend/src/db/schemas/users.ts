import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    webhook_slug: uuid('webhook_slug')
        .unique()
        .notNull()
        .default(sql`gen_random_uuid()`),

    name: varchar('name', { length: 255 })
        .notNull(),

    username: varchar('username', { length: 255 })
        .notNull()
        .unique(),

    password: text('password')
        .notNull(),

    token: text('token')
        .unique(),

    role: varchar('role')
        .notNull()
        .default('user'),

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