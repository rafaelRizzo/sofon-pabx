import { z } from 'zod'
import { timestamp, ok } from '../../../../schemas/responses'

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const routingConditionsSchema = z
    .object({
        trunkId: z.cuid2().optional(),
        callerIdPattern: z.string().max(80).optional(),
        weekdays: z.array(z.enum(WEEKDAYS)).min(1).optional(),
        startTime: z.string().regex(timeRegex, 'Invalid time format HH:MM').optional(),
        endTime: z.string().regex(timeRegex, 'Invalid time format HH:MM').optional(),
    })
    .default({})

export const idParamSchema = z.object({ id: z.cuid2() })
export const companyIdParamSchema = z.object({ id_company: z.cuid2() })

export const createRoutingRuleSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    priority: z.number().int().min(0).max(1000).default(0),
    conditions: routingConditionsSchema,
    active: z.boolean().default(true),
})

export const updateRoutingRuleSchema = z
    .object({
        name: z.string().min(1).max(80).optional(),
        priority: z.number().int().min(0).max(1000).optional(),
        conditions: routingConditionsSchema.optional(),
        active: z.boolean().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type CreateRoutingRuleInput = z.infer<typeof createRoutingRuleSchema>
export type UpdateRoutingRuleInput = z.infer<typeof updateRoutingRuleSchema>

const RoutingConditionsResponseSchema = z.object({
    trunkId: z.string().optional(),
    callerIdPattern: z.string().optional(),
    weekdays: z.array(z.string()).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
})

export const RoutingRuleSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    priority: z.number(),
    conditions: RoutingConditionsResponseSchema,
    active: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListRoutingRulesResponse = ok({ message: z.string(), routingRules: z.array(RoutingRuleSchema) })
export const GetRoutingRuleResponse = ok({ message: z.string(), routingRule: RoutingRuleSchema })
export const CreateRoutingRuleResponse = ok({ message: z.string(), routingRuleId: z.string() })
export const UpdateRoutingRuleResponse = ok({ message: z.string() })
