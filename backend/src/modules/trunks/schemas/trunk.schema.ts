import { z } from 'zod'
import { EXTENSION_STATUSES, EXTENSION_DTMFMODES, EXTENSION_NAT_MODES } from '../../../db/enums'

export const createTrunkSchema = z.object({
    company_id: z.string().uuid('Invalid company ID'),
    name: z.string().min(1, 'Name is required'),
    type: z.string().default('sip'),
    host: z.string().min(1, 'Host is required'),
    port: z.number().int().min(1).max(65535).default(5060),
    username: z.string().optional(),
    password: z.string().optional(),
    fromuser: z.string().optional(),
    fromdomain: z.string().optional(),
    context: z.string().default('from-trunk'),
    allow: z.string().optional(),
    disallow: z.string().optional(),
    insecure: z.string().optional(),
    nat: z.enum(EXTENSION_NAT_MODES).default('yes'),
    qualify: z.string().default('yes'),
    directmedia: z.boolean().optional(),
    send_register: z.boolean().default(false),
    register_string: z.string().optional(),
    outbound_proxy: z.string().optional(),
    codecs: z.array(z.string()).default(['ulaw', 'alaw']),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export const updateTrunkSchema = createTrunkSchema.partial().extend({
    status: z.enum(EXTENSION_STATUSES).optional(),
})

export const idParamSchema = z.object({
    id: z.string().uuid('Invalid trunk ID'),
})

export const companyIdParamSchema = z.object({
    companyId: z.string().uuid('Invalid company ID'),
})

export type CreateTrunkInput = z.infer<typeof createTrunkSchema>
export type UpdateTrunkInput = z.infer<typeof updateTrunkSchema>
