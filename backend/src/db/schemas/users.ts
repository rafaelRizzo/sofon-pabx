import {
    pgTable,
    bigint,
    uuid,
    varchar,
    text,
    timestamp,
    index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { generateSnowflake } from '../../utils/generators/snowflake.generator'

export const users = pgTable('users', {
    id: bigint('id', { mode: 'bigint' })
        .primaryKey()
        .$defaultFn(() => generateSnowflake.generate()),

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
}, (table) => [
    index().on(table.status),
])