import { z } from 'zod'

export const idParamSchema = z.object({
    id: z.uuid(),
})

const timeRegex = /^\d{2}:\d{2}$/

export const createOfficeTimeSchema = z.object({
    company_id: z.uuid(),
    name: z.string().min(1).max(255).trim(),
    description: z.string().max(500).trim().optional(),
    day_of_week: z.number().int().min(0).max(6),
    is_working_day: z.boolean().default(true),

    start_time: z.string().regex(timeRegex).nullable().optional(),
    end_time: z.string().regex(timeRegex).nullable().optional(),

    lunch_start: z.string().regex(timeRegex).nullable().optional(),
    lunch_end: z.string().regex(timeRegex).nullable().optional(),

    obs: z.string().max(1024).trim().optional(),
}).superRefine((data, ctx) => {
    // ✔ se for dia útil → precisa horário
    if (data.is_working_day) {
        if (!data.start_time) {
            ctx.addIssue({
                code: 'custom',
                path: ['start_time'],
                message: 'start_time is required when is_working_day is true',
            })
        }

        if (!data.end_time) {
            ctx.addIssue({
                code: 'custom',
                path: ['end_time'],
                message: 'end_time is required when is_working_day is true',
            })
        }
    }

    // se não trabalha, ignora resto
    if (!data.is_working_day) return

    if (!data.start_time || !data.end_time) return

    // ✔ end > start (faltava isso)
    if (data.end_time <= data.start_time) {
        ctx.addIssue({
            code: 'custom',
            path: ['end_time'],
            message: 'end_time must be after start_time',
        })
    }

    // ✔ almoço completo
    if ((data.lunch_start && !data.lunch_end) || (!data.lunch_start && data.lunch_end)) {
        ctx.addIssue({
            code: 'custom',
            path: ['lunch_start'],
            message: 'lunch_start and lunch_end must be provided together',
        })
    }

    if (data.lunch_start && data.lunch_end) {
        if (data.lunch_start >= data.lunch_end) {
            ctx.addIssue({
                code: 'custom',
                path: ['lunch_start'],
                message: 'lunch_start must be before lunch_end',
            })
        }

        if (
            data.lunch_start < data.start_time ||
            data.lunch_end > data.end_time
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['lunch_start'],
                message: 'Lunch must be within working hours',
            })
        }
    }
})

export const updateOfficeTimeSchema = z.object({
    name: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(500).trim().optional(),
    day_of_week: z.number().int().min(0).max(6).optional(),
    is_working_day: z.boolean().optional(),

    start_time: z.string().regex(timeRegex).nullable().optional(),
    end_time: z.string().regex(timeRegex).nullable().optional(),

    lunch_start: z.string().regex(timeRegex).nullable().optional(),
    lunch_end: z.string().regex(timeRegex).nullable().optional(),

    obs: z.string().max(1024).trim().optional(),
    status: z.enum(['active', 'inactive']).optional(),
}).superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
        ctx.addIssue({
            code: 'custom',
            message: 'At least one field must be provided',
        })
    }

    if (data.is_working_day === true) {
        if (!data.start_time) {
            ctx.addIssue({
                code: 'custom',
                path: ['start_time'],
                message: 'start_time is required when is_working_day is true',
            })
        }

        if (!data.end_time) {
            ctx.addIssue({
                code: 'custom',
                path: ['end_time'],
                message: 'end_time is required when is_working_day is true',
            })
        }
    }

    if ((data.lunch_start && !data.lunch_end) || (!data.lunch_start && data.lunch_end)) {
        ctx.addIssue({
            code: 'custom',
            path: ['lunch_start'],
            message: 'lunch_start and lunch_end must be provided together',
        })
    }

    if (data.lunch_start && data.lunch_end) {
        if (data.lunch_start >= data.lunch_end) {
            ctx.addIssue({
                code: 'custom',
                path: ['lunch_start'],
                message: 'lunch_start must be before lunch_end',
            })
        }
    }
})

export const getByCompanyParamSchema = z.object({
    company_id: z.uuid(),
})

export type CreateOfficeTimeInput = z.infer<typeof createOfficeTimeSchema>
export type UpdateOfficeTimeInput = z.infer<typeof updateOfficeTimeSchema>
export type IdParamInput = z.infer<typeof idParamSchema>
export type GetByCompanyInput = z.infer<typeof getByCompanyParamSchema>