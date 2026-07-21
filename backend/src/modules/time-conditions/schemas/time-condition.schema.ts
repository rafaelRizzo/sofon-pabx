import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { ROUTE_DEST_TYPES, routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'
import { usedBySchema } from '../../../schemas/flow-reference-label'

export const ROUTE_TYPES = ROUTE_DEST_TYPES

export const routeDestSchema = routeDestinationSchema

export type RouteDest = z.infer<typeof routeDestSchema>

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const createTimeConditionSchema = z.object({
    name:       z.string().min(1).max(80).regex(/^[^\x00-\x1f\x7f]*$/, 'Nome não pode conter caracteres de controle'),
    companyId:  z.cuid2(),
    trueRoute:  routeDestSchema.optional(),
    falseRoute: routeDestSchema.optional(),
    groupIds:   z.array(z.cuid2()).default([]),
})

export const updateTimeConditionSchema = z.object({
    name:       z.string().min(1).max(80).regex(/^[^\x00-\x1f\x7f]*$/, 'Nome não pode conter caracteres de controle').optional(),
    trueRoute:  routeDestSchema.optional(),
    falseRoute: routeDestSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, trueRoute, falseRoute' })

export type CreateTimeConditionInput = z.infer<typeof createTimeConditionSchema>
export type UpdateTimeConditionInput = z.infer<typeof updateTimeConditionSchema>

const TimeGroupRefSchema = z.object({
    id:   z.string(),
    name: z.string(),
})

export const TimeConditionSchema = z.object({
    id:         z.string(),
    name:       z.string(),
    companyId:  z.string(),
    trueRoute:  routeDestinationResponseSchema,
    falseRoute: routeDestinationResponseSchema,
    usedBy:     usedBySchema,
    timeGroups: z.array(z.object({ timeGroup: TimeGroupRefSchema })),
    createdAt:  timestamp,
    updatedAt:  timestamp,
})

export const ListTimeConditionsResponse = ok({ message: z.string(), timeConditions: z.array(TimeConditionSchema) })
export const GetTimeConditionResponse = ok({ message: z.string(), timeCondition: TimeConditionSchema })
export const CreateTimeConditionResponse = ok({ message: z.string(), timeConditionId: z.string() })
export const UpdateTimeConditionResponse = ok({ message: z.string() })
