import {
    pgTable,
    uuid,
    varchar,
    timestamp,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const COMPANY_PLANS = ['free', 'basic', 'pro', 'enterprise'] as const
type CompanyPlan = (typeof COMPANY_PLANS)[number]

export const companies = pgTable('companies', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    name: varchar('name', { length: 255 })
        .notNull(),

    cnpj: varchar('cnpj', { length: 14 })
        .notNull()
        .unique(),

    plan: varchar('plan', { length: 50 })
        .$type<CompanyPlan>()
        .notNull()
        .default('free'),

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