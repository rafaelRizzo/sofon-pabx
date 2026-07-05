import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const updateAudioSchema = z.object({
    name: z.string().min(1).max(80),
})

export type UpdateAudioInput = z.infer<typeof updateAudioSchema>

// multipart não usa `body` do Fastify — campos de texto (enviados ANTES do arquivo, ver
// audios.controller.ts) são validados manualmente com esse schema
export const createAudioFieldsSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
})

export const AudioSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListAudiosResponse = ok({ message: z.string(), audios: z.array(AudioSchema) })
export const GetAudioResponse = ok({ message: z.string(), audio: AudioSchema })
export const CreateAudioResponse = ok({ message: z.string(), audioId: z.string() })
export const UpdateAudioResponse = ok({ message: z.string() })
