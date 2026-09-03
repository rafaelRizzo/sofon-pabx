import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const companyIdParamSchema = z.object({
    id: z.cuid2(),
})

const importResultSchema = z.object({
    created: z.number().int(),
    warnings: z.array(z.string()),
})

export const importSummarySchema = z.object({
    extensions: importResultSchema,
    trunks: importResultSchema,
    queues: importResultSchema,
    queueMembers: importResultSchema.extend({ skippedAgents: z.number().int() }),
})

export const ImportIssabelResponse = ok({ summary: importSummarySchema })

export type ImportSummary = z.infer<typeof importSummarySchema>
