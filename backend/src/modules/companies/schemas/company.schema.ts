import { z } from 'zod'
import { timestamp } from '../../../schemas/responses'

export const idParamSchema = z.object({
    id: z.cuid2(),
})

export const userIdParamSchema = z.object({
    id_user: z.cuid2(),
})

export const createCompanySchema = z.object({
    name: z.string().min(1),
    doc: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional().default({}),
    userId: z.cuid2().optional(),
})

export const updateCompanySchema = z.object({
    name: z.string().min(1).optional(),
    doc: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
})

export type IdParam = z.infer<typeof idParamSchema>
export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>

export const CompanySchema = z.object({
    id: z.string(),
    name: z.string(),
    doc: z.string().nullable(),
    metadata: z.record(z.unknown()),
    createdAt: timestamp,
    updatedAt: timestamp,
})
