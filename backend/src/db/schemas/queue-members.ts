import { sql } from 'drizzle-orm'
import {
    pgTable,
    uuid,
    integer,
    boolean,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core'
import { queues } from './queues'
import { extensions } from './extensions'

export const queueMembers = pgTable('queue_members', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    queue_id: uuid('queue_id')
        .notNull()
        .references(() => queues.id, { onDelete: 'cascade' }),

    extension_id: uuid('extension_id')
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
])
