import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'

const baseTrunkShape = {
    name: z
        .string()
        .min(1)
        .max(20)
        .regex(/^[a-z0-9_-]+$/i, 'Only alphanumeric, dash and underscore allowed'),
    companyId: z.cuid2(),
    codecs: z.string().max(200).default('ulaw,alaw'),
    maxInChannels: z.number().int().min(1).optional(),
    maxOutChannels: z.number().int().min(1).optional(),
}

const portShape = { port: z.number().int().min(1).max(65535).optional() }

export const createTrunkSchema = z.discriminatedUnion('registrationMode', [
    z.object({
        ...baseTrunkShape,
        ...portShape,
        registrationMode: z.literal('outbound'),
        host: z.string().min(1).max(255),
        username: z.string().min(1).max(80),
        password: z.string().min(1).max(80),
    }),
    z.object({
        ...baseTrunkShape,
        ...portShape,
        registrationMode: z.literal('inbound'),
        host: z.string().min(1).max(255).optional(),
        username: z.string().min(1).max(80).optional(),
        password: z.string().min(1).max(80).optional(),
    }),
])

export const updateTrunkSchema = z.object({
    host: z.string().min(1).max(255).optional(),
    port: z.number().int().min(1).max(65535).nullable().optional(),
    username: z.string().min(1).max(80).nullable().optional(),
    password: z.string().min(1).max(80).optional(),
    codecs: z.string().max(200).optional(),
    maxInChannels: z.number().int().min(1).nullable().optional(),
    maxOutChannels: z.number().int().min(1).nullable().optional(),
})

export const trunkIdParamSchema = z.object({ id: z.cuid2() })
export const trunkQuerySchema = z.object({ companyId: z.cuid2() })

export type CreateTrunkInput = z.infer<typeof createTrunkSchema>
export type UpdateTrunkInput = z.infer<typeof updateTrunkSchema>

export const TrunkSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    registrationMode: z.enum(['outbound', 'inbound']),
    identifyBy: z.enum(['ip', 'username']).nullable(),
    host: z.string().nullable(),
    port: z.number().nullable(),
    username: z.string().nullable(),
    password: z.string().nullable(),
    context: z.string(),
    codecs: z.string(),
    maxInChannels: z.number().nullable(),
    maxOutChannels: z.number().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListTrunksResponse = ok({ message: z.string(), trunks: z.array(TrunkSchema) })
export const GetTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
export const CreateTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
export const UpdateTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
