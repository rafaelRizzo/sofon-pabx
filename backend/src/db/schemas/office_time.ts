import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    time,
    boolean,
    integer,
    uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { companies } from './companies'

export const office_time = pgTable('office_time', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    company_id: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 })
        .notNull(),

    description: varchar('description', { length: 500 }),

    // Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    day_of_week: integer('day_of_week')
        .notNull(), // 0-6

    // Whether it's a working day
    is_working_day: boolean('is_working_day')
        .notNull()
        .default(true),

    // Start time of business hours (e.g., 08:00)
    start_time: time('start_time'),

    // End time of business hours (e.g., 18:00)
    end_time: time('end_time'),

    // Lunch break time (optional - can be null if no lunch)
    lunch_start: time('lunch_start'),
    lunch_end: time('lunch_end'),

    // Additional remarks or notes
    obs: varchar('obs', { length: 1024 }),

    status: varchar('status')
        .notNull()
        .default('active'),

    created_at: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),

    updated_at: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [
    uniqueIndex('office_time_company_day_unique').on(t.company_id, t.day_of_week)
])