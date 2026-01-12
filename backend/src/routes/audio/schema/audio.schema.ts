import { z } from 'zod'

const uuidSchema = z.cuid({ message: 'Formato de id inválido' })

export const createAudioSchema = {
    body: z.object({
        companyId: uuidSchema,
        name: z.string().min(1, 'Nome é obrigatório').max(255),
        filename: z.string().min(1, 'Nome é obrigatório').max(255),
    })
}

export const getAudioSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export const deleteAudioSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export type CreateAudioInput = z.infer<typeof createAudioSchema.body>
export type GetAudioParams = z.infer<typeof getAudioSchema.params>
export type DeleteAudioParams = z.infer<typeof deleteAudioSchema.params>