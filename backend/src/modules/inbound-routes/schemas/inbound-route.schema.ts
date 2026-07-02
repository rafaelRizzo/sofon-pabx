import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const destinationSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('extension'),     id: z.cuid2() }),
    z.object({ type: z.literal('queue'),         id: z.cuid2() }),
    z.object({ type: z.literal('voicemail'),     id: z.cuid2() }),
    z.object({ type: z.literal('timecondition'), id: z.cuid2() }),
    z.object({ type: z.literal('hangup') }),
]).nullable()

export type InboundDest = z.infer<typeof destinationSchema>

export const createInboundRouteSchema = z.object({
    name:        z.string().min(1).max(80),
    companyId:   z.cuid2(),
    didId:       z.cuid2(),
    trunkId:     z.cuid2(),
    destination: destinationSchema.optional(),
})

export const updateInboundRouteSchema = z.object({
    name:        z.string().min(1).max(80).optional(),
    destination: destinationSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, destination' })

export type CreateInboundRouteInput = z.infer<typeof createInboundRouteSchema>
export type UpdateInboundRouteInput = z.infer<typeof updateInboundRouteSchema>

const DestinationResponseSchema = z.union([
    z.object({ type: z.literal('extension'),     id: z.string() }),
    z.object({ type: z.literal('queue'),         id: z.string() }),
    z.object({ type: z.literal('voicemail'),     id: z.string() }),
    z.object({ type: z.literal('timecondition'), id: z.string() }),
    z.object({ type: z.literal('hangup') }),
]).nullable()

export const InboundRouteSchema = z.object({
    id:          z.string(),
    name:        z.string(),
    companyId:   z.string(),
    didId:       z.string(),
    trunkId:     z.string(),
    did:         z.object({ id: z.string(), number: z.string() }),
    trunk:       z.object({ id: z.string(), name: z.string() }),
    destination: DestinationResponseSchema,
    createdAt:   timestamp,
    updatedAt:   timestamp,
})

export const ListInboundRoutesResponse = ok({ message: z.string(), inboundRoutes: z.array(InboundRouteSchema) })
export const GetInboundRouteResponse = ok({ message: z.string(), inboundRoute: InboundRouteSchema })
export const CreateInboundRouteResponse = ok({ message: z.string(), inboundRouteId: z.string() })
export const UpdateInboundRouteResponse = ok({ message: z.string() })
