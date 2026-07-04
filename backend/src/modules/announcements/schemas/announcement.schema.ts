import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const createAnnouncementSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
})

export const updateAnnouncementSchema = z.object({
    name: z.string().min(1).max(80),
})

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>

export const AnnouncementSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    hasAudio: z.boolean().describe('true quando o áudio já foi enviado e convertido — só então o destino pode ser usado em rotas'),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListAnnouncementsResponse = ok({ message: z.string(), announcements: z.array(AnnouncementSchema) })
export const GetAnnouncementResponse = ok({ message: z.string(), announcement: AnnouncementSchema })
export const CreateAnnouncementResponse = ok({ message: z.string(), announcementId: z.string() })
export const UpdateAnnouncementResponse = ok({ message: z.string() })
export const UploadAnnouncementAudioResponse = ok({ message: z.string(), announcement: AnnouncementSchema })
