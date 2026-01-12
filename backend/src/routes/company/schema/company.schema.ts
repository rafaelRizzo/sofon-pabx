import { z } from 'zod'

const uuidSchema = z.cuid({ message: 'Formato de id inválido' })

export const createCompanySchema = {
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(255)
    })
}

export const updateCompanySchema = {
    params: z.object({
        id: uuidSchema
    }),
    body: z.object({
        name: z.string().min(1).max(255).optional()
    })
}

export const getCompanySchema = {
    params: z.object({
        id: uuidSchema
    })
}

export const deleteCompanySchema = {
    params: z.object({
        id: uuidSchema
    })
}

export type CreateCompanyInput = z.infer<typeof createCompanySchema.body>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema.body>
export type GetCompanyParams = z.infer<typeof getCompanySchema.params>
export type DeleteCompanyParams = z.infer<typeof deleteCompanySchema.params>