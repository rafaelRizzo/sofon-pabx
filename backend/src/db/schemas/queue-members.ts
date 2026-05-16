import {
    pgTable,
    bigint,
    integer,
    boolean,
    timestamp,
    uniqueIndex,
    index,
} from 'drizzle-orm/pg-core'
import { queues } from './queues'
import { extensions } from './extensions'
import { generateSnowflake } from '../../utils/generators/snowflake.generator'

export const queueMembers = pgTable('queue_members', {
    id: bigint('id', { mode: 'bigint' })
        .primaryKey()
        .$defaultFn(() => generateSnowflake.generate()),

    queue_id: bigint('queue_id', { mode: 'bigint' })
        .notNull()
        .references(() => queues.id, { onDelete: 'cascade' }),

    extension_id: bigint('extension_id', { mode: 'bigint' })
        .notNull()
        .references(() => extensions.id, { onDelete: 'cascade' }),

    penalty: integer('penalty')
        .default(0),

    paused: boolean('paused')
        .default(false),

    created_at: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),

    updated_at: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex('queue_members_queue_extension_unique').on(table.queue_id, table.extension_id),
    index().on(table.queue_id),
    index().on(table.extension_id),
])
