import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const BACKUP_VERSION = 1

export const backupExportQuerySchema = z.object({
    // ausente = backup de todas as empresas (admin-only, ver backup.controller.ts)
    companyId: z.cuid2().optional()
})

export type BackupExportQuery = z.infer<typeof backupExportQuerySchema>

// Envelope só — cada bloco de empresa é validado entidade por entidade, contra o próprio schema
// de create de cada módulo, dentro de restore.ts (não duplicar aqui os ~15 schemas existentes)
export const backupRestoreSchema = z.object({
    backupVersion: z.literal(BACKUP_VERSION),
    generatedAt: z.string(),
    companies: z.array(z.record(z.string(), z.unknown())).min(1)
})

export type BackupRestoreInput = z.infer<typeof backupRestoreSchema>

export const RestoreCompanyResultSchema = z.object({
    originalName: z.string(),
    newCompanyId: z.string().optional(),
    error: z.string().optional()
})

export const RestoreBackupResponse = ok({
    message: z.string(),
    results: z.array(RestoreCompanyResultSchema)
})
