import { z } from 'zod'

export const idParamSchema = z.object({
    id: z.cuid2(),
})

export const createUserSchema = z.object({
    name: z.string().min(1),
    username: z.email(),
    password: z.string().min(6),
})

export const updateUserSchema = z.object({
    name: z.string().min(1).optional(),
    username: z.email().optional(),
    password: z.string().min(6).optional(),
})

export type IdParam = z.infer<typeof idParamSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
