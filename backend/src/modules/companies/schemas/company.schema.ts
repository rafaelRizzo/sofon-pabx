import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'

const IANA_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'))
const timezoneSchema = z.string().refine((tz) => IANA_TIMEZONES.has(tz), { message: 'Invalid IANA timezone' })

export const companyStatusSchema = z.enum(['active', 'inactive', 'blocked'])

export const idParamSchema = z.object({
    id: z.cuid2(),
})

export const userIdParamSchema = z.object({
    id_user: z.cuid2(),
})

export const createCompanySchema = z.object({
    name: z.string().min(1),
    doc: z.string().optional(),
    status: companyStatusSchema.optional(),
    timezone: timezoneSchema.optional(),
    metadata: z.record(z.string(), z.string()).optional().default({}),
    elevenLabsApiKey: z.string().trim().min(1).nullable().optional(),
    notes: z.string().max(10000).nullable().optional(),
})

export const updateCompanySchema = z.object({
    name: z.string().min(1).optional(),
    doc: z.string().optional(),
    status: companyStatusSchema.optional(),
    timezone: timezoneSchema.optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    elevenLabsApiKey: z.string().trim().min(1).nullable().optional(),
    notes: z.string().max(10000).nullable().optional(),
})

export type IdParam = z.infer<typeof idParamSchema>
export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>

export const CompanySchema = z.object({
    id: z.string(),
    name: z.string(),
    doc: z.string().nullable(),
    status: companyStatusSchema,
    timezone: z.string(),
    metadata: z.record(z.string(), z.unknown()),
    elevenLabsApiKey: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListCompaniesResponse = ok({ message: z.string(), companies: z.array(CompanySchema) })
export const GetCompanyResponse = ok({ message: z.string(), company: CompanySchema })
export const CreateCompanyResponse = ok({ message: z.string(), companyId: z.string() })
export const UpdateCompanyResponse = ok({ message: z.string() })
export const ResyncDialplanResponse = ok({
    message: z.string(),
    baseDialplanRewritten: z.boolean(),
    blindTransferRemoved: z.boolean(),
    blindTransferReloadApplied: z.boolean(),
    staticContexts: z.array(z.string()),
    realtimeContexts: z.array(z.string()),
    inboundRoutes: z.number(),
    outboundRoutes: z.number(),
    orphansPruned: z.number(),
    reloadApplied: z.boolean(),
})

export const ResyncAllDialplansResponse = ok({
    message: z.string(),
    total: z.number(),
    succeeded: z.number(),
    failed: z.number(),
    results: z.array(z.object({
        companyId: z.string(),
        name: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
    })),
})
