import { z } from 'zod'
import { cnpj } from 'cpf-cnpj-validator'

const COMPANY_PLANS = ['free', 'basic', 'pro', 'enterprise'] as const
const COMPANY_STATUSES = ['active', 'inactive', 'suspended'] as const
const COMPANY_USER_ROLES = ['owner', 'admin'] as const

const onlyNumbers = (value: string) => value.replace(/\D/g, '')

export const idParamSchema = z.object({
    id: z.uuid(),
})

export const removeMemberParamSchema = z.object({
    id: z.uuid(),
    user_id: z.uuid(),
})

export const createCompanySchema = z.object({
    name: z.string().min(1).max(255),

    cnpj: z.string()
        .min(1, 'CNPJ é obrigatório')
        .transform(onlyNumbers)
        .refine(cnpj.isValid, 'CNPJ inválido'),

    plan: z.enum(['free', 'basic', 'pro', 'enterprise']).default('free'),
    status: z.enum(['active', 'inactive', 'suspended']).default('active'),
})

export const updateCompanySchema = z.object({
    name: z.string().min(1).max(255).optional(),

    cnpj: z.string()
        .transform(onlyNumbers)
        .refine((v) => !v || cnpj.isValid(v), 'CNPJ inválido')
        .optional(),

    plan: z.enum(['free', 'basic', 'pro', 'enterprise']).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
)

export const addMemberSchema = z.object({
    user_id: z.uuid(),
    role: z.enum(COMPANY_USER_ROLES).default('owner'),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>