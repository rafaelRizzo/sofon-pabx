import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'
import { usedBySchema } from '../../../schemas/flow-reference-label'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })
export const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

// path avaliado sobre o JSON de resposta (ex: "data.client[0].id") — ver evalResponsePath em agi-server.ts
const variableMappingSchema = z.object({
    path: z.string().min(1).max(200),
    variable: z.string().min(1).max(80).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Only letters, digits and underscore, starting with a letter or underscore'),
})

export const createRequestTemplateSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    method: z.enum(HTTP_METHODS).default('GET'),
    // pode conter placeholders {{VAR}} resolvidos via AGI GET VARIABLE (ex: {{CALLERID(num)}}, {{EXTEN}})
    url: z.string().min(1).max(2048),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    timeoutMs: z.number().int().min(500).max(30000).default(5000),
    variableMappings: z.array(variableMappingSchema).max(20).default([]),
    onSuccess: routeDestinationSchema.optional(),
    onError: routeDestinationSchema.optional(),
})

export const updateRequestTemplateSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    method: z.enum(HTTP_METHODS).optional(),
    url: z.string().min(1).max(2048).optional(),
    headers: z.record(z.string(), z.string()).nullable().optional(),
    body: z.record(z.string(), z.unknown()).nullable().optional(),
    timeoutMs: z.number().int().min(500).max(30000).optional(),
    variableMappings: z.array(variableMappingSchema).max(20).optional(),
    onSuccess: routeDestinationSchema.optional(),
    onError: routeDestinationSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type CreateRequestTemplateInput = z.infer<typeof createRequestTemplateSchema>
export type UpdateRequestTemplateInput = z.infer<typeof updateRequestTemplateSchema>
export type VariableMapping = z.infer<typeof variableMappingSchema>

export const RequestTemplateSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    method: z.string(),
    url: z.string(),
    headers: z.record(z.string(), z.string()).nullable(),
    body: z.record(z.string(), z.unknown()).nullable(),
    timeoutMs: z.number(),
    variableMappings: z.array(variableMappingSchema),
    onSuccess: routeDestinationResponseSchema,
    onError: routeDestinationResponseSchema,
    usedBy: usedBySchema,
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListRequestTemplatesResponse = ok({ message: z.string(), requestTemplates: z.array(RequestTemplateSchema) })
export const GetRequestTemplateResponse = ok({ message: z.string(), requestTemplate: RequestTemplateSchema })
export const CreateRequestTemplateResponse = ok({ message: z.string(), requestTemplateId: z.string() })
export const UpdateRequestTemplateResponse = ok({ message: z.string() })
