import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const createAnnouncementSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    audioId: z.cuid2().optional().describe('id de um Audio (POST /audios) já enviado — sem ele o anúncio fica sem dialplan até vincular um depois'),
    destination: routeDestinationSchema.optional(),
})

export const updateAnnouncementSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    audioId: z.cuid2().nullable().optional(),
    destination: routeDestinationSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, audioId, destination' })

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>

export const AnnouncementSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    audioId: z.string().nullable(),
    hasAudio: z.boolean().describe('true quando há um Audio vinculado — só então o destino pode ser usado em rotas'),
    destination: routeDestinationResponseSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListAnnouncementsResponse = ok({ message: z.string(), announcements: z.array(AnnouncementSchema) })
export const GetAnnouncementResponse = ok({ message: z.string(), announcement: AnnouncementSchema })
export const CreateAnnouncementResponse = ok({ message: z.string(), announcementId: z.string() })
export const UpdateAnnouncementResponse = ok({ message: z.string() })
