import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    uniqueIndex
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { companies } from './companies'

const COMPANY_USER_ROLES = ['owner', 'admin'] as const
type CompanyUserRole = (typeof COMPANY_USER_ROLES)[number]

export const userCompanies = pgTable('user_companies', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    user_id: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    company_id: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),

    role: varchar('role', { length: 50 })
        .$type<CompanyUserRole>()
        .notNull()
        .default('owner'),

    created_at: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),

}, (t) => [
    uniqueIndex('user_company_unique').on(t.user_id, t.company_id)
])