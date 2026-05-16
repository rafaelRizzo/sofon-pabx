import { z } from 'zod'
import { EXTENSION_STATUSES } from '../../../db/enums'

export const createQueueSchema = z.object({
    company_id: z.string().regex(/^\d+$/, 'Invalid company ID').transform(v => BigInt(v)),
    name: z.string().min(1, 'Name is required'),
    number: z.string().min(1, 'Number is required'),
    account_code: z.string().min(1, 'Account code is required'),
    strategy: z.string().default('ringall'),
    timeout: z.number().int().min(1).default(15),
    maxlen: z.number().int().min(0).optional(),
    musiconhold: z.string().optional(),
    announce: z.string().optional(),
    joinempty: z.string().default('yes'),
    leavewhenempty: z.string().default('no'),
    weight: z.number().int().default(0),
    autopause: z.string().default('no'),
    announcefrequency: z.number().int().optional(),
    announceholdtime: z.string().optional(),
    context: z.string().default('from-queue'),
    obs: z.string().max(1000, 'Obs must be 1000 characters or less').optional(),
})

export const updateQueueSchema = createQueueSchema.partial().extend({
    status: z.enum(EXTENSION_STATUSES).optional(),
})

export const idParamSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Invalid queue ID').transform(v => BigInt(v)),
})

export const companyIdParamSchema = z.object({
    companyId: z.string().regex(/^\d+$/, 'Invalid company ID').transform(v => BigInt(v)),
})

export type CreateQueueInput = z.infer<typeof createQueueSchema>
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>
