import { z } from 'zod'
import { EXTENSION_STATUSES, TRUNK_TYPES, TRUNK_INSECURE_OPTIONS, CODECS_ENUM } from '../../../db/enums'

export const createTrunkSchema = z.object({
    company_id: z.string().regex(/^\d+$/, 'Invalid company ID').transform(v => BigInt(v)),
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    type: z.enum(TRUNK_TYPES).default('sip'),
    host: z.string().min(1, 'Host is required').max(255, 'Host too long'),
    port: z.number().int().min(1, 'Port must be positive').max(65535, 'Port too high').default(5060),
    username: z.string().max(255, 'Username too long').optional(),
    password: z.string().max(255, 'Password too long').optional(),
    fromuser: z.string().max(255, 'From user too long').optional(),
    fromdomain: z.string().max(255, 'From domain too long').optional(),
    context: z.string().max(100, 'Context too long').default('from-trunk'),
    disallow: z.string().optional(),
    insecure: z.string().max(100, 'Insecure too long').optional(),
    nat: z.enum(['yes', 'no', 'force_rport', 'comedia'] as const).default('yes'),
    qualify: z.union([
        z.literal('yes'),
        z.literal('no'),
        z.number().int().positive('Must be positive integer (milliseconds)').transform(v => v.toString())
    ]).default('yes'),
    directmedia: z.boolean().default(false),
    send_register: z.boolean().default(false),
    register_string: z.string().max(500, 'Register string too long').optional().refine(
        (val) => !val || val.length > 0,
        'Register string cannot be empty if provided'
    ),
    outbound_proxy: z.string().max(255, 'Outbound proxy too long').optional(),
    codecs: z.array(z.enum(CODECS_ENUM)).min(1, 'At least one codec required').default(['ulaw', 'alaw']),
    obs: z.string().max(1000, 'Observations too long').optional(),
})

export const updateTrunkSchema = createTrunkSchema.partial().extend({
    status: z.enum(EXTENSION_STATUSES).optional(),
})

export const idParamSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Invalid trunk ID').transform(v => BigInt(v)),
})

export const companyIdParamSchema = z.object({
    companyId: z.string().regex(/^\d+$/, 'Invalid company ID').transform(v => BigInt(v)),
})

export type CreateTrunkInput = z.infer<typeof createTrunkSchema>
export type UpdateTrunkInput = z.infer<typeof updateTrunkSchema>
