import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const loginSchema = z.object({
    username: z.email(),
    password: z.string().min(6),
})

export type LoginInput = z.infer<typeof loginSchema>

// Primeiro usuário do sistema - sempre criado como admin, sem vínculo de empresa (admin bypassa escopo)
export const registerSchema = z.object({
    name: z.string().min(1),
    username: z.email(),
    password: z.string().min(6),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const TokenResponse = ok({ message: z.string(), token: z.string() })
export const LogoutResponse = ok({ message: z.string() })

export const MeSchema = z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    role: z.enum(['admin', 'reseller', 'user']),
    permissions: z.array(z.string()),
    extensionId: z.string().nullable(),
})
export const MeResponse = ok({ message: z.string(), user: MeSchema })
