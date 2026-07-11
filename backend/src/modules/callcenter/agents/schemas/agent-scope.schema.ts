import { z } from 'zod'
import { timestamp, ok } from '../../../../schemas/responses'

export const idParamSchema = z.object({ id: z.cuid2() })
export const companyIdParamSchema = z.object({ id_company: z.cuid2() })

export const createAgentScopeSchema = z.object({
    extensionId: z.cuid2(),
    companyId: z.cuid2(),
    active: z.boolean().default(true),
})

export const updateAgentScopeSchema = z.object({
    active: z.boolean(),
})

export type CreateAgentScopeInput = z.infer<typeof createAgentScopeSchema>
export type UpdateAgentScopeInput = z.infer<typeof updateAgentScopeSchema>

export const AgentScopeSchema = z.object({
    id: z.string(),
    extensionId: z.string(),
    companyId: z.string(),
    active: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListAgentScopesResponse = ok({ message: z.string(), scopes: z.array(AgentScopeSchema) })
export const CreateAgentScopeResponse = ok({ message: z.string(), scopeId: z.string() })
export const UpdateAgentScopeResponse = ok({ message: z.string() })
