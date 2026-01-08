import { z } from 'zod'

const uuidSchema = z.cuid({ message: 'Formato de id inválido' })

export const createUserSchema = {
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório'),
        username: z.string().min(1, 'Username é obrigatório'),
        password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
        role: z.enum(['admin', 'agent']).default('agent'),
        status: z.enum(['active', 'inactive']).default('active')
    })
}

export const updateUserSchema = {
    params: z.object({
        id: uuidSchema
    }),
    body: z.object({
        name: z.string().min(1).optional(),
        username: z.string().min(1).optional(),
        password: z.string().min(6).optional(),
        role: z.enum(['admin', 'agent']).optional(),
        status: z.enum(['active', 'inactive']).optional()
    })
}

export const getUserSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export const deleteUserSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export type CreateUserInput = z.infer<typeof createUserSchema.body>
export type UpdateUserInput = z.infer<typeof updateUserSchema.body>
export type GetUserParams = z.infer<typeof getUserSchema.params>
export type DeleteUserParams = z.infer<typeof deleteUserSchema.params>