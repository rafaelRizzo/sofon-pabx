import { z } from 'zod'
import { EXTENSION_STATUSES, EXTENSION_DTMFMODES, EXTENSION_NAT_MODES } from '../../../db/enums'

export const createExtensionSchema = z.object({
    company_id: z.string().uuid('Invalid company ID'),
    number: z.string().min(1, 'Number is required'),
    account_code: z.string().min(1, 'Account code is required'),
    name: z.string().min(1, 'Name is required'),
    secret: z.string().min(1, 'Secret is required'),
    host: z.string().default('dynamic'),
    type: z.string().default('friend'),
    send_register: z.boolean().default(false),
    register_string: z.string().optional(),
    nat: z.enum(EXTENSION_NAT_MODES).default('yes'),
    qualify: z.string().default('yes'),
    dtmfmode: z.enum(EXTENSION_DTMFMODES).default('rfc2833'),
    context: z.string().default('from-internal'),
    codecs: z.array(z.string()).default(['ulaw', 'alaw']),
    allow: z.string().optional(),
    disallow: z.string().optional(),
    insecure: z.string().optional(),
    directmedia: z.boolean().optional(),
    callgroup: z.string().optional(),
    pickupgroup: z.string().optional(),
    voicemail: z.string().optional(),
    mailbox: z.string().optional(),
    username: z.string().optional(),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export const updateExtensionSchema = createExtensionSchema.partial().extend({
    status: z.enum(EXTENSION_STATUSES).optional(),
})

export const idParamSchema = z.object({
    id: z.string().uuid('Invalid extension ID'),
})

export const companyIdParamSchema = z.object({
    companyId: z.string().uuid('Invalid company ID'),
})

export type CreateExtensionInput = z.infer<typeof createExtensionSchema>
export type UpdateExtensionInput = z.infer<typeof updateExtensionSchema>
