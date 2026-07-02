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
    codecs: z.string().max(200).optional(),
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
    host: z.string().nullable(),
    username: z.string().nullable(),
    context: z.string(),
    codecs: z.string(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListTrunksResponse = ok({ message: z.string(), trunks: z.array(TrunkSchema) })
export const GetTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
export const CreateTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
export const UpdateTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
