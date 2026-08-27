import { z } from 'zod'
import { ok, timestamp } from '../../../schemas/responses'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

// Espelha AUDITED_MODELS (src/lib/prisma.ts) - mantido separado pra não vazar detalhe de
// implementação do extension pro schema de resposta/filtro da API
export const AUDIT_LOG_MODELS = [
    'Company', 'User', 'Did', 'Extension', 'Queue', 'QueueMember', 'Trunk',
    'OutboundRoute', 'TimeGroup', 'TimeCondition', 'HolidayGroup', 'InboundRoute',
    'Announcement', 'Audio', 'IvrMenu', 'RequestTemplate', 'VariableSet',
    'VariableCondition', 'IntegrationCredential', 'IxcNode', 'Flow',
    'AgentCompanyScope', 'RoutingRule',
] as const

export const auditLogQuerySchema = z.object({
    companyId: z.cuid2().optional(),
    actorId: z.cuid2().optional(),
    model: z.enum(AUDIT_LOG_MODELS).optional(),
    recordId: z.string().max(150).optional(),
    action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    page: z.coerce.number().int().min(1).default(1),
    order: z.enum(['asc', 'desc']).default('desc'),
}).refine(
    (value) => !value.startDate || !value.endDate || value.startDate <= value.endDate,
    { message: 'startDate must be before or equal to endDate', path: ['endDate'] },
)

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>

export const AuditLogSchema = z.object({
    id: z.string(),
    actorId: z.string(),
    actorName: z.string().nullable(),
    ip: z.string().nullable(),
    action: z.string(),
    model: z.string(),
    recordId: z.string().nullable(),
    companyId: z.string().nullable(),
    before: z.unknown().nullable(),
    after: z.unknown().nullable(),
    createdAt: timestamp,
})

export const ListAuditLogsResponse = ok({
    records: z.array(AuditLogSchema),
    total: z.number(),
    limit: z.number(),
    page: z.number(),
})
