import { z } from 'zod'

const TYPE_ERP = ['ixcsoft', 'sgp', 'hubsoft', 'radius_net'] as const

export const idParamSchema = z.object({
    id: z.uuid(),
})

export const companyParamSchema = z.object({
    company_id: z.uuid(),
})

const ixcsoftAuthConfig = z.object({
    token: z.string().max(2048).trim(),
    url: z.url().max(2048).trim(),
})

const ixcsoftConfigData = z.object({
    generate_prospect: z.boolean().default(true),
    type_prospect: z.enum(['prospect', 'lead']).default('prospect'),
    open_ticket: z.boolean().default(true),
    check_open_ticket: z.boolean().default(true),
    enable_search_client_by_phone: z.boolean().default(true),
    timeout: z.coerce.number().min(10).max(60).default(60),
    support_id_issue: z.coerce.number().min(1).max(65535),
    commercial_id_issue: z.coerce.number().min(1).max(65535),
    financial_id_issue: z.coerce.number().min(1).max(65535),
    general_id_issue: z.coerce.number().min(1).max(65535),
    support_id_sector: z.coerce.number().min(1).max(65535),
    commercial_id_sector: z.coerce.number().min(1).max(65535),
    financial_id_sector: z.coerce.number().min(1).max(65535),
    general_id_sector: z.coerce.number().min(1).max(65535),
})

const sgpAuthConfig = z.object({
    token: z.string().max(2048).trim(),
    app: z.string().max(512).trim(),
    url: z.url().max(2048),
})

const sgpConfigData = z.object({
    open_ticket: z.boolean().default(true),
    check_open_ticket: z.boolean().default(true),
    enable_search_client_by_phone: z.boolean().default(true),
    timeout: z.coerce.number().min(10).max(60).default(60),
    support_id_ocurrence: z.coerce.number().min(1).max(65535),
    commercial_id_ocurrence: z.coerce.number().min(1).max(65535),
    financial_id_ocurrence: z.coerce.number().min(1).max(65535),
    general_id_ocurrence: z.coerce.number().min(1).max(65535),
    support_id_sector: z.coerce.number().min(1).max(65535),
    commercial_id_sector: z.coerce.number().min(1).max(65535),
    financial_id_sector: z.coerce.number().min(1).max(65535),
    general_id_sector: z.coerce.number().min(1).max(65535),
    support_id_wo: z.coerce.number().min(1).max(65535),
    commercial_id_wo: z.coerce.number().min(1).max(65535),
    financial_id_wo: z.coerce.number().min(1).max(65535),
    general_id_wo: z.coerce.number().min(1).max(65535),
    disable_open_wo: z.boolean().default(true),
})

const hubsoftAuthConfig = z.object({
    token: z.string().max(2048).trim(),
    url: z.url().max(2048),
})

const hubsoftConfigData = z.object({
    open_ticket: z.boolean().default(true),
    check_open_ticket: z.boolean().default(true),
    enable_search_client_by_phone: z.boolean().default(true),
    timeout: z.coerce.number().min(10).max(60).default(60)
})

const createIxcsoftSchema = z.object({
    name: z.string().min(1).max(255).trim(),
    company_id: z.uuid(),
    type: z.literal('ixcsoft'),
    auth: ixcsoftAuthConfig,
    config: ixcsoftConfigData,
})

const createSgpSchema = z.object({
    name: z.string().min(1).max(255).trim(),
    company_id: z.uuid(),
    type: z.literal('sgp'),
    auth: sgpAuthConfig,
    config: sgpConfigData,
})

const createHubsoftSchema = z.object({
    name: z.string().min(1).max(255).trim(),
    company_id: z.uuid(),
    type: z.literal('hubsoft'),
    auth: hubsoftAuthConfig,
    config: hubsoftConfigData,
})

export const createInstanceSchema = z.discriminatedUnion('type', [
    createIxcsoftSchema,
    createSgpSchema,
    createHubsoftSchema,
])

export const updateInstanceSchema = z.object({
    name: z.string().min(1).max(255).trim().optional(),
    type: z.enum(TYPE_ERP).optional(),
    auth: z.record(z.string().trim(), z.unknown()).optional(),
    config: z.record(z.string().trim(), z.unknown()).optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    {
        message: 'At least one field must be provided for update'
    }
)

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>
export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>