import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'

export const ROUTE_TYPES = ['extension', 'queue', 'voicemail', 'timecondition', 'hangup'] as const

export const routeDestSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('extension'),     id: z.cuid2() }),
    z.object({ type: z.literal('queue'),         id: z.cuid2() }),
    z.object({ type: z.literal('voicemail'),     id: z.cuid2() }),
    z.object({ type: z.literal('timecondition'), id: z.cuid2() }),
    z.object({ type: z.literal('hangup') }),
]).nullable()

export type RouteDest = z.infer<typeof routeDestSchema>

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const createTimeConditionSchema = z.object({
    name:       z.string().min(1).max(80),
    companyId:  z.cuid2(),
    trueRoute:  routeDestSchema.optional(),
    falseRoute: routeDestSchema.optional(),
    groupIds:   z.array(z.cuid2()).default([]),
})

export const updateTimeConditionSchema = z.object({
    name:       z.string().min(1).max(80).optional(),
    trueRoute:  routeDestSchema.optional(),
    falseRoute: routeDestSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' })

export type CreateTimeConditionInput = z.infer<typeof createTimeConditionSchema>
export type UpdateTimeConditionInput = z.infer<typeof updateTimeConditionSchema>

const RouteDestResponseSchema = z.union([
    z.object({ type: z.literal('extension'),     id: z.string() }),
    z.object({ type: z.literal('queue'),         id: z.string() }),
    z.object({ type: z.literal('voicemail'),     id: z.string() }),
    z.object({ type: z.literal('timecondition'), id: z.string() }),
    z.object({ type: z.literal('hangup') }),
]).nullable()

const TimeGroupRefSchema = z.object({
    id:   z.string(),
    name: z.string(),
})

export const TimeConditionSchema = z.object({
    id:         z.string(),
    name:       z.string(),
    companyId:  z.string(),
    trueRoute:  RouteDestResponseSchema,
    falseRoute: RouteDestResponseSchema,
    timeGroups: z.array(z.object({ timeGroup: TimeGroupRefSchema })),
    createdAt:  timestamp,
    updatedAt:  timestamp,
})

export const ListTimeConditionsResponse = ok({ message: z.string(), timeConditions: z.array(TimeConditionSchema) })
export const GetTimeConditionResponse = ok({ message: z.string(), timeCondition: TimeConditionSchema })
export const CreateTimeConditionResponse = ok({ message: z.string(), timeConditionId: z.string() })
export const UpdateTimeConditionResponse = ok({ message: z.string() })
