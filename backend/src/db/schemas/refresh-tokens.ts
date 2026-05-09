import {
    pgTable,
    uuid,
    text,
    timestamp,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

export const refreshTokens = pgTable('refresh_tokens', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    user_id: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    token_jti: text('token_jti')
        .notNull()
        .unique(),

    expires_at: timestamp('expires_at', { withTimezone: true })
        .notNull(),

    created_at: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
})
