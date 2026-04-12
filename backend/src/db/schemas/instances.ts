import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    jsonb,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { companies } from './companies'

const TYPE_ERP = ['ixcsoft', 'sgp', 'hubsoft', 'radius_net'] as const
type TypeErp = (typeof TYPE_ERP)[number]

export const instances = pgTable('instances', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    name: varchar('name', { length: 255 })
        .unique()
        .notNull(),

    company_id: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),

    type: varchar('role', { length: 50 })
        .$type<TypeErp>()
        .notNull(),

    auth: jsonb('auth')
        .notNull()
        .default({}),

    config: jsonb('config')
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
        .$onUpdate(() => new Date())
})