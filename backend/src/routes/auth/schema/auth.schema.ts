import { z } from 'zod'

export const signInSchema = {
    body: z.object({
        username: z.string().max(255),
        password: z.string().max(255)
    })
}

export type SignInInput = z.infer<typeof signInSchema.body>