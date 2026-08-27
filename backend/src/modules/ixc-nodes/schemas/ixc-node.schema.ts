import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'
import { usedBySchema } from '../../../schemas/flow-reference-label'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })
export const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

export const IXC_NODE_ACTIONS = ['listar_cliente', 'listar_boleto'] as const

// path avaliado sobre o JSON de resposta (ex: "cliente[0].id") - mesmo mecanismo de RequestTemplate
const variableMappingSchema = z.object({
    path: z.string().min(1).max(200),
    variable: z.string().min(1).max(80).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Only letters, digits and underscore, starting with a letter or underscore'),
})

export const createIxcNodeSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    credentialId: z.cuid2(),
    action: z.enum(IXC_NODE_ACTIONS),
    // pode conter placeholders {{VAR}} resolvidos via AGI GET VARIABLE (ex: {{CALLERID(num)}})
    params: z.record(z.string(), z.string()).optional(),
    timeoutMs: z.number().int().min(500).max(30000).default(5000),
    variableMappings: z.array(variableMappingSchema).max(20).default([]),
    onSuccess: routeDestinationSchema.optional(),
    onError: routeDestinationSchema.optional(),
})

export const updateIxcNodeSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    credentialId: z.cuid2().optional(),
    action: z.enum(IXC_NODE_ACTIONS).optional(),
    params: z.record(z.string(), z.string()).optional(),
    timeoutMs: z.number().int().min(500).max(30000).optional(),
    variableMappings: z.array(variableMappingSchema).max(20).optional(),
    onSuccess: routeDestinationSchema.optional(),
    onError: routeDestinationSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type CreateIxcNodeInput = z.infer<typeof createIxcNodeSchema>
export type UpdateIxcNodeInput = z.infer<typeof updateIxcNodeSchema>
export type IxcNodeVariableMapping = z.infer<typeof variableMappingSchema>

export const IxcNodeSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    credentialId: z.string(),
    action: z.enum(IXC_NODE_ACTIONS),
    params: z.record(z.string(), z.string()),
    timeoutMs: z.number(),
    variableMappings: z.array(variableMappingSchema),
    onSuccess: routeDestinationResponseSchema,
    onError: routeDestinationResponseSchema,
    usedBy: usedBySchema,
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListIxcNodesResponse = ok({ message: z.string(), ixcNodes: z.array(IxcNodeSchema) })
export const GetIxcNodeResponse = ok({ message: z.string(), ixcNode: IxcNodeSchema })
export const CreateIxcNodeResponse = ok({ message: z.string(), ixcNodeId: z.string() })
export const UpdateIxcNodeResponse = ok({ message: z.string() })
