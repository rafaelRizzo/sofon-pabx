import { z } from 'zod'

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
})

export const updateOutboundRouteSchema = z
    .object({
        name: z.string().min(1).max(80).optional(),
        position: z.number().int().min(0).optional(),
        trunkIds: z.array(z.cuid2()).min(1).optional(),
        patterns: z.array(patternSchema).min(1).optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
        message: 'At least one field is required',
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
        message: 'At least one field is required',
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
