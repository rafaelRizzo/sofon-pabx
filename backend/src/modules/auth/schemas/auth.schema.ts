import z from 'zod'

export const authUserSchema = z.object({
    username: z.string().max(255),
    password: z.string().max(255)
})

export type AuthUserInput = z.infer<typeof authUserSchema>