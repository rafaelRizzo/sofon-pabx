import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const loginSchema = z.object({
    username: z.email(),
    password: z.string().min(6),
})

export type LoginInput = z.infer<typeof loginSchema>

export const TokenResponse = ok({ message: z.string(), token: z.string() })
export const LogoutResponse = ok({ message: z.string() })
