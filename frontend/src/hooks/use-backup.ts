"use client"

import { useState } from "react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type RestoreCompanyResult = {
    originalName: string
    newCompanyId?: string
    error?: string
    // usuário pulado por username duplicado - não derruba o restore da empresa (ver
    // backend/src/modules/backup/restore.ts)
    userWarnings?: string[]
}

export type BackupPayload = {
    backupVersion: number
    generatedAt: string
    companies: Record<string, unknown>[]
}

export type BackupSummary = {
    backupVersion: number
    generatedAt: string
    companies: { name: string; entityCount: number }[]
}

// Mesmas chaves de export.ts (backend) - usado só pra contar quantas entidades tem em cada
// empresa do arquivo, pra mostrar um resumo antes do restore de fato
const ENTITY_KEYS = [
    "extensions",
    "trunks",
    "dids",
    "audios",
    "timeGroups",
    "integrationCredentials",
    "ixcNodes",
    "queues",
    "timeConditions",
    "holidayGroups",
    "inboundRoutes",
    "announcements",
    "ivrMenus",
    "requestTemplates",
    "variableSets",
    "variableConditions",
    "outboundRoutes",
    "agentCompanyScopes",
    "routingRules",
    "flows",
    "users",
] as const

function extractFilename(disposition: unknown, fallback: string): string {
    if (typeof disposition !== "string") return fallback
    const match = disposition.match(/filename="?([^"]+)"?/)
    return match?.[1] ?? fallback
}

// Sem companyId = backup de todas as empresas (admin only, ver backup.controller.ts)
export async function downloadBackupExport(companyId?: string) {
    const res = await api.get("/backup/export", {
        params: companyId ? { companyId } : undefined,
        responseType: "blob",
    })
    const filename = extractFilename(
        res.headers["content-disposition"],
        companyId ? `backup-${companyId}.json` : "backup-todas-empresas.json"
    )
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// Lançada quando o arquivo selecionado não é um JSON de backup válido - a tela mostra a
// mensagem direto ao usuário em vez de um erro genérico de parse
export class InvalidBackupFileError extends Error {}

export async function parseBackupFile(file: File): Promise<BackupPayload> {
    let json: unknown
    try {
        json = JSON.parse(await file.text())
    } catch {
        throw new InvalidBackupFileError("Arquivo não é um JSON válido")
    }
    if (
        typeof json !== "object" ||
        json === null ||
        !Array.isArray((json as BackupPayload).companies)
    ) {
        throw new InvalidBackupFileError(
            "Arquivo não parece ser um backup gerado por esta tela"
        )
    }
    return json as BackupPayload
}

export function summarizeBackup(payload: BackupPayload): BackupSummary {
    return {
        backupVersion: payload.backupVersion,
        generatedAt: payload.generatedAt,
        companies: payload.companies.map((c) => ({
            name:
                typeof (c as any)?.company?.name === "string"
                    ? (c as any).company.name
                    : "(desconhecido)",
            entityCount: ENTITY_KEYS.reduce(
                (sum, key) =>
                    sum + (Array.isArray((c as any)[key]) ? (c as any)[key].length : 0),
                0
            ),
        })),
    }
}

async function restoreBackupPayload(
    payload: BackupPayload
): Promise<RestoreCompanyResult[]> {
    const { data } = await api.post("/backup/restore", payload)
    return data.results ?? []
}

export function useBackupExport() {
    const [exporting, setExporting] = useState(false)

    const exportBackup = async (companyId?: string) => {
        setExporting(true)
        const id = toast.loading("Gerando backup...")
        try {
            await downloadBackupExport(companyId)
            toast.success("Backup gerado", { id })
        } catch (err) {
            toast.error(apiError(err, "Erro ao gerar backup"), { id })
        } finally {
            setExporting(false)
        }
    }

    return { exporting, exportBackup }
}

export function useBackupRestore() {
    const [restoring, setRestoring] = useState(false)
    const [results, setResults] = useState<RestoreCompanyResult[] | null>(null)

    const restore = async (payload: BackupPayload) => {
        setRestoring(true)
        setResults(null)
        const id = toast.loading("Restaurando backup...")
        try {
            const restoreResults = await restoreBackupPayload(payload)
            setResults(restoreResults)
            const failed = restoreResults.filter((r) => r.error).length
            if (failed === 0) {
                toast.success(
                    `Restore concluído (${restoreResults.length} empresa(s))`,
                    { id }
                )
            } else {
                toast.warning(
                    `Restore concluído com ${failed} erro(s) de ${restoreResults.length}`,
                    { id }
                )
            }
        } catch (err) {
            toast.error(apiError(err, "Erro ao restaurar backup"), { id })
        } finally {
            setRestoring(false)
        }
    }

    return { restoring, results, restore }
}
