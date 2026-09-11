import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const destinationSchema = routeDestinationSchema

export type InboundDest = z.infer<typeof destinationSchema>

export const createInboundRouteSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    didId: z.cuid2(),
    trunkId: z.cuid2(),
    destination: destinationSchema.optional(),
    notes: z.string().max(10000).optional(),
})

export const updateInboundRouteSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    destination: destinationSchema.optional(),
    notes: z.string().max(10000).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, destination' })

export type CreateInboundRouteInput = z.infer<typeof createInboundRouteSchema>
export type UpdateInboundRouteInput = z.infer<typeof updateInboundRouteSchema>

export const InboundRouteSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    didId: z.string(),
    trunkId: z.string(),
    did: z.object({ id: z.string(), number: z.string() }),
    trunk: z.object({ id: z.string(), name: z.string() }),
    destination: routeDestinationResponseSchema,
    notes: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListInboundRoutesResponse = ok({ message: z.string(), inboundRoutes: z.array(InboundRouteSchema) })
export const GetInboundRouteResponse = ok({ message: z.string(), inboundRoute: InboundRouteSchema })
export const CreateInboundRouteResponse = ok({ message: z.string(), inboundRouteId: z.string() })
export const UpdateInboundRouteResponse = ok({ message: z.string() })
