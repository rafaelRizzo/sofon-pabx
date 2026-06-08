import { z } from 'zod'

export const loginSchema = z.object({
    username: z.email(),
    password: z.string().min(6),
})

export type LoginInput = z.infer<typeof loginSchema>
