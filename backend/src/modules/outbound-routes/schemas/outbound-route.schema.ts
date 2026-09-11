import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'

const patternSchema = z.object({
    pattern: z.string().min(1).max(40),
    prepend: z.string().max(40).nullable().optional(),
    prefix: z.string().max(40).nullable().optional(),
    position: z.number().int().min(0).default(0),
})

export const createOutboundRouteSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    position: z.number().int().min(0).default(0),
    trunkIds: z.array(z.cuid2()).min(1),
    patterns: z.array(patternSchema).min(1),
    extensionIds: z.array(z.cuid2()).optional(),
    notes: z.string().max(10000).optional(),
})

export const updateOutboundRouteSchema = z
    .object({
        name: z.string().min(1).max(80).optional(),
        position: z.number().int().min(0).optional(),
        trunkIds: z.array(z.cuid2()).min(1).optional(),
        patterns: z.array(patternSchema).min(1).optional(),
        notes: z.string().max(10000).optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
        message: 'At least one field is required: name, position, trunkIds, patterns, notes',
    })

export const addPatternSchema = patternSchema

export const updatePatternSchema = z
    .object({
        pattern: z.string().min(1).max(40).optional(),
        prepend: z.string().max(40).nullable().optional(),
        prefix: z.string().max(40).nullable().optional(),
        position: z.number().int().min(0).optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
        message: 'At least one field is required: pattern, prepend, prefix, position',
    })

export const setTrunksSchema = z.object({
    trunkIds: z.array(z.cuid2()).min(1),
})

export const addExtensionSchema = z.object({
    extensionId: z.cuid2(),
})

export const routeIdParamSchema = z.object({ id: z.cuid2() })
export const patternIdParamSchema = z.object({ id: z.cuid2(), patternId: z.cuid2() })
export const extensionParamSchema = z.object({ id: z.cuid2(), extensionId: z.cuid2() })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export type CreateOutboundRouteInput = z.infer<typeof createOutboundRouteSchema>
export type UpdateOutboundRouteInput = z.infer<typeof updateOutboundRouteSchema>
export type AddPatternInput = z.infer<typeof addPatternSchema>
export type UpdatePatternInput = z.infer<typeof updatePatternSchema>
export type SetTrunksInput = z.infer<typeof setTrunksSchema>

export const PatternSchema = z.object({
    id: z.string(),
    routeId: z.string(),
    pattern: z.string(),
    prefix: z.string().nullable(),
    prepend: z.string().nullable(),
    position: z.number(),
})

export const OutboundRouteSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    position: z.number(),
    patterns: z.array(PatternSchema),
    trunks: z.array(z.object({ id: z.string(), trunkId: z.string(), position: z.number() })),
    extensions: z.array(z.object({ id: z.string(), extensionId: z.string() })),
    notes: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListOutboundRoutesResponse = ok({ routes: z.array(OutboundRouteSchema) })
export const GetOutboundRouteResponse = ok({ route: OutboundRouteSchema })
export const CreateOutboundRouteResponse = ok({ message: z.string(), outboundRouteId: z.string() })
export const UpdateOutboundRouteResponse = ok({ route: OutboundRouteSchema })
export const SetTrunksResponse = ok({ route: OutboundRouteSchema })
export const AddPatternResponse = ok({ message: z.string(), patternId: z.string() })
export const UpdatePatternResponse = ok({ message: z.string() })
export const AddExtensionResponse = ok({ message: z.string(), outboundRouteExtensionId: z.string() })
