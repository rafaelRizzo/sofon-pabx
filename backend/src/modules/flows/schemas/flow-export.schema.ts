import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const FLOW_EXPORT_KIND = 'sofon-flow-export'
export const FLOW_EXPORT_VERSION = 1

// Envelope só - cada nó é validado contra o próprio create schema do recurso que ele referencia,
// dentro de flow-import.service.ts (mesmo espírito do backup: não duplicar aqui os ~10 schemas
// de recurso já existentes, ver backup/schemas/backup.schema.ts)
export const flowExportBundleSchema = z.object({
    kind: z.literal(FLOW_EXPORT_KIND),
    version: z.literal(FLOW_EXPORT_VERSION),
    flow: z.record(z.string(), z.unknown())
})

export const flowImportResolutionsSchema = z
    .object({
        extensions: z.record(z.string(), z.cuid2()).optional(),
        credentials: z.record(z.string(), z.cuid2()).optional()
    })
    .optional()

export const flowImportPreviewSchema = z.object({
    companyId: z.cuid2(),
    bundle: flowExportBundleSchema
})

export const flowImportSchema = z.object({
    companyId: z.cuid2(),
    bundle: flowExportBundleSchema,
    resolutions: flowImportResolutionsSchema
})

export type FlowImportPreviewInput = z.infer<typeof flowImportPreviewSchema>
export type FlowImportInput = z.infer<typeof flowImportSchema>

const pendingExtensionSchema = z.object({
    nodeId: z.string(),
    label: z.string().nullable(),
    hint: z.string().nullable(),
    flowName: z.string()
})

const pendingCredentialSchema = z.object({
    nodeId: z.string(),
    label: z.string().nullable(),
    provider: z.string(),
    nameHint: z.string(),
    flowName: z.string()
})

export const FlowImportPreviewResponse = ok({
    message: z.string(),
    flowName: z.string(),
    pendingExtensions: z.array(pendingExtensionSchema),
    pendingCredentials: z.array(pendingCredentialSchema),
    availableExtensions: z.array(z.object({ id: z.string(), alias: z.string(), name: z.string() })),
    availableCredentials: z.array(z.object({ id: z.string(), provider: z.string(), name: z.string() }))
})

export const FlowImportResponse = ok({
    message: z.string(),
    flowId: z.string()
})
