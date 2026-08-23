import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })
export const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

// Catálogo de provedores suportados — cresce a cada integração nova sem precisar de um model
// próprio por provedor (ver IntegrationCredential no schema.prisma).
export const INTEGRATION_PROVIDERS = ['ixc'] as const
export const providerQuerySchema = z.object({ provider: z.enum(INTEGRATION_PROVIDERS).optional() })

export const createIntegrationCredentialSchema = z.object({
    provider: z.enum(INTEGRATION_PROVIDERS),
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    baseUrl: z.string().url().max(255),
    // token da API do provedor — nunca armazenado em texto puro (ver src/lib/crypto.ts) e nunca
    // retornado em GET; pra trocar, reenviar o campo inteiro
    token: z.string().min(1).max(500),
})

export const updateIntegrationCredentialSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    baseUrl: z.string().url().max(255).optional(),
    token: z.string().min(1).max(500).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type CreateIntegrationCredentialInput = z.infer<typeof createIntegrationCredentialSchema>
export type UpdateIntegrationCredentialInput = z.infer<typeof updateIntegrationCredentialSchema>

export const IntegrationCredentialSchema = z.object({
    id: z.string(),
    provider: z.enum(INTEGRATION_PROVIDERS),
    name: z.string(),
    companyId: z.string(),
    company: z.object({ id: z.string(), name: z.string() }),
    baseUrl: z.string(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListIntegrationCredentialsResponse = ok({ message: z.string(), integrationCredentials: z.array(IntegrationCredentialSchema) })
export const GetIntegrationCredentialResponse = ok({ message: z.string(), integrationCredential: IntegrationCredentialSchema })
export const CreateIntegrationCredentialResponse = ok({ message: z.string(), integrationCredentialId: z.string() })
export const UpdateIntegrationCredentialResponse = ok({ message: z.string() })
