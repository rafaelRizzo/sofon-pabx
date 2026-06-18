import { z } from 'zod'

const baseTrunkShape = {
    name: z
        .string()
        .min(1)
        .max(20)
        .regex(/^[a-z0-9_-]+$/i, 'Only alphanumeric, dash and underscore allowed'),
    companyId: z.cuid2(),
    type: z.enum(['sip', 'pjsip']),
    context: z.string().max(40).default('from-trunk'),
    codecs: z.string().max(200).default('ulaw,alaw'),
}

export const createTrunkSchema = z.discriminatedUnion('registrationMode', [
    z.object({
        ...baseTrunkShape,
        registrationMode: z.literal('outbound'),
        host: z.string().min(1).max(255),
        username: z.string().min(1).max(80),
        password: z.string().min(1).max(80),
    }),
    z.object({
        ...baseTrunkShape,
        registrationMode: z.literal('inbound'),
        host: z.string().min(1).max(255).optional(),
        username: z.string().min(1).max(80).optional(),
        password: z.string().min(1).max(80).optional(),
    }),
])

export const updateTrunkSchema = z.object({
    host: z.string().min(1).max(255).optional(),
    username: z.string().min(1).max(80).optional(),
    password: z.string().min(1).max(80).optional(),
    context: z.string().max(40).optional(),
    codecs: z.string().max(200).optional(),
})

export const trunkIdParamSchema = z.object({ id: z.cuid2() })
export const trunkQuerySchema = z.object({ companyId: z.cuid2() })

export type CreateTrunkInput = z.infer<typeof createTrunkSchema>
export type UpdateTrunkInput = z.infer<typeof updateTrunkSchema>
