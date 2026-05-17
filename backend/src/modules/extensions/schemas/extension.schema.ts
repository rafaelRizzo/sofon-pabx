import { z } from 'zod'
import { EXTENSION_STATUSES, EXTENSION_TYPES, CODECS_ENUM } from '../../../db/enums'
import { snowflakeId } from '../../../utils/validators/snowflake.validator'

export const createExtensionSchema = z.object({
    company_id: snowflakeId('company ID'),
    number: z.string().min(1, 'Number is required').max(10, 'Number too long'),
    account_code: z.string().min(1, 'Account code is required').max(20, 'Account code too long'),
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    secret: z.string().min(8, 'Secret must be at least 8 characters').max(255, 'Secret too long'),
    host: z.string().default('dynamic').default('dynamic'),
    type: z.enum(EXTENSION_TYPES).default('friend'),
    nat: z.enum(['yes', 'no', 'force_rport', 'comedia'] as const).default('yes'),
    qualify: z.union([
        z.literal('yes'),
        z.literal('no'),
        z.number().int().positive('Must be positive integer (milliseconds)').transform(v => v.toString())
    ]).default('yes'),
    dtmfmode: z.enum(['inband', 'rfc2833', 'info', 'auto'] as const).default('rfc2833'),
    context: z.string().max(100, 'Context too long').default('from-internal'),
    codecs: z.array(z.enum(CODECS_ENUM)).min(1, 'At least one codec required').default(['ulaw', 'alaw']),
    disallow: z.string().optional(),
    insecure: z.string().max(100, 'Insecure too long').optional(),
    directmedia: z.boolean().default(false),
    callgroup: z.string().max(100, 'Callgroup too long').optional(),
    pickupgroup: z.string().max(100, 'Pickupgroup too long').optional(),
    voicemail: z.string().max(20, 'Voicemail too long').optional(),
    mailbox: z.string().max(100, 'Mailbox too long').optional(),
    username: z.string().max(100, 'Username too long').optional(),
    obs: z.string().max(1000, 'Observations too long').optional(),
})

export const updateExtensionSchema = createExtensionSchema.partial().extend({
    status: z.enum(EXTENSION_STATUSES).optional(),
})

export const idParamSchema = z.object({
    id: snowflakeId('extension ID'),
})

export const companyIdParamSchema = z.object({
    companyId: snowflakeId('company ID'),
})

export type CreateExtensionInput = z.infer<typeof createExtensionSchema>
export type UpdateExtensionInput = z.infer<typeof updateExtensionSchema>
