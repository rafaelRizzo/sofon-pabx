import { z } from 'zod'
import { RecurrencyType } from '../../../generated/prisma/enums'

/**
 * Helpers
 */
const cuidSchema = z.cuid({ message: 'Formato de id inválido' })

const timeSchema = z
    .string()
    .regex(
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        'Formato de hora inválido (HH:mm)'
    )

/**
 * Create TimeRule
 */
export const createTimeRuleSchema = {
    body: z
        .object({
            name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),

            recurrencyType: z.enum(RecurrencyType),

            startDate: z.coerce.date().optional(),
            endDate: z.coerce.date().optional(),

            startTime: timeSchema,
            endTime: timeSchema,

            weekDays: z
                .array(z.number().int().min(0).max(6))
                .optional()
                .default([]),

            monthDays: z
                .array(z.number().int().min(1).max(31))
                .optional()
                .default([]),

            months: z
                .array(z.number().int().min(1).max(12))
                .optional()
                .default([]),

            timeConditionId: cuidSchema,
            companyId: cuidSchema
        })
        .superRefine((data, ctx) => {
            if (data.startDate && data.endDate && data.startDate > data.endDate) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['endDate'],
                    message: 'endDate deve ser maior ou igual a startDate'
                })
            }

            if (data.recurrencyType === 'WEEKLY' && data.weekDays.length === 0) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['weekDays'],
                    message: 'weekDays é obrigatório para recorrência semanal'
                })
            }

            if (data.recurrencyType === 'MONTHLY' && data.monthDays.length === 0) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['monthDays'],
                    message: 'monthDays é obrigatório para recorrência mensal'
                })
            }

            if (data.recurrencyType === 'YEARLY' && data.months.length === 0) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['months'],
                    message: 'months é obrigatório para recorrência anual'
                })
            }
        })
}

/**
 * Update TimeRule
 */
export const updateTimeRuleSchema = {
    params: z.object({
        id: cuidSchema
    }),
    body: z
        .object({
            name: z.string().min(1).max(100).optional(),

            recurrencyType: z.enum(RecurrencyType).optional(),

            startDate: z.coerce.date().optional(),
            endDate: z.coerce.date().optional(),

            startTime: timeSchema.optional(),
            endTime: timeSchema.optional(),

            weekDays: z.array(z.number().int().min(0).max(6)).optional(),
            monthDays: z.array(z.number().int().min(1).max(31)).optional(),
            months: z.array(z.number().int().min(1).max(12)).optional()
        })
        .superRefine((data, ctx) => {
            if (data.startDate && data.endDate && data.startDate > data.endDate) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['endDate'],
                    message: 'endDate deve ser maior ou igual a startDate'
                })
            }
        })
}

/**
 * Get TimeRule
 */
export const getTimeRuleSchema = {
    params: z.object({
        id: cuidSchema
    })
}

/**
 * Delete TimeRule
 */
export const deleteTimeRuleSchema = {
    params: z.object({
        id: cuidSchema
    })
}

/**
 * Types
 */
export type CreateTimeRuleInput =
    z.infer<typeof createTimeRuleSchema.body>

export type UpdateTimeRuleInput =
    z.infer<typeof updateTimeRuleSchema.body>

export type GetTimeRuleParams =
    z.infer<typeof getTimeRuleSchema.params>

export type DeleteTimeRuleParams =
    z.infer<typeof deleteTimeRuleSchema.params>
