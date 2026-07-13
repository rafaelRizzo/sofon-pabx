import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const loginSchema = z.object({
    username: z.email(),
    password: z.string().min(6),
})

export type LoginInput = z.infer<typeof loginSchema>

export const TokenResponse = ok({ message: z.string(), token: z.string() })
export const LogoutResponse = ok({ message: z.string() })

export const MeSchema = z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    role: z.enum(['admin', 'reseller', 'user']),
    permissions: z.array(z.string()),
})
export const MeResponse = ok({ message: z.string(), user: MeSchema })
