import {
    pgTable,
    bigint,
    text,
    timestamp,
    index,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { generateSnowflake } from '../../utils/generators/snowflake.generator'

export const refreshTokens = pgTable('refresh_tokens', {
    id: bigint('id', { mode: 'bigint' })
        .primaryKey()
        .$defaultFn(() => generateSnowflake.generate()),

    user_id: bigint('user_id', { mode: 'bigint' })
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
}, (table) => [
    index().on(table.user_id),
    index().on(table.expires_at),
])
