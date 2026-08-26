"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

const FLOW_EXPORT_KIND = "sofon-flow-export"
const FLOW_EXPORT_VERSION = 1

export type FlowExportBundle = {
    kind: typeof FLOW_EXPORT_KIND
    version: typeof FLOW_EXPORT_VERSION
    flow: Record<string, unknown>
}

export type PendingExtension = {
    nodeId: string
    label: string | null
    hint: string | null
    flowName: string
}

export type PendingCredential = {
    nodeId: string
    label: string | null
    provider: string
    nameHint: string
    flowName: string
}

export type FlowImportPreview = {
    flowName: string
    pendingExtensions: PendingExtension[]
    pendingCredentials: PendingCredential[]
    availableExtensions: { id: string; alias: string; name: string }[]
    availableCredentials: { id: string; provider: string; name: string }[]
}

export type FlowImportResolutions = {
    extensions: Record<string, string>
    credentials: Record<string, string>
}

function extractFilename(disposition: unknown, fallback: string): string {
    if (typeof disposition !== "string") return fallback
    const match = disposition.match(/filename="?([^"]+)"?/)
    return match?.[1] ?? fallback
}

export async function downloadFlowExport(flowId: string, flowName: string) {
    const res = await api.get(`/flows/${flowId}/export`, {
        responseType: "blob",
    })
    const filename = extractFilename(
        res.headers["content-disposition"],
        `flow-${flowName}.json`
    )
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// Lançada quando o arquivo selecionado não é um JSON de export de flow válido — a tela mostra a
// mensagem direto ao usuário em vez de um erro genérico de parse
export class InvalidFlowExportFileError extends Error {}

export async function parseFlowExportFile(file: File): Promise<FlowExportBundle> {
    let json: unknown
    try {
        json = JSON.parse(await file.text())
    } catch {
        throw new InvalidFlowExportFileError("Arquivo não é um JSON válido")
    }
    const bundle = json as Partial<FlowExportBundle>
    if (bundle?.kind !== FLOW_EXPORT_KIND || bundle?.version !== FLOW_EXPORT_VERSION || !bundle.flow) {
        throw new InvalidFlowExportFileError(
            "Arquivo não parece ser um export de flow gerado por esta tela"
        )
    }
    return bundle as FlowExportBundle
}

export function useFlowExport() {
    const [exporting, setExporting] = useState(false)

    const exportFlow = async (flowId: string, flowName: string) => {
        setExporting(true)
        const id = toast.loading("Gerando export do flow...")
        try {
            await downloadFlowExport(flowId, flowName)
            toast.success("Export gerado", { id })
        } catch (err) {
            toast.error(apiError(err, "Erro ao exportar flow"), { id })
        } finally {
            setExporting(false)
        }
    }

    return { exporting, exportFlow }
}

export function useFlowImport() {
    const queryClient = useQueryClient()
    const [analyzing, setAnalyzing] = useState(false)
    const [importing, setImporting] = useState(false)

    const previewImport = async (
        bundle: FlowExportBundle,
        companyId: string
    ): Promise<FlowImportPreview | null> => {
        setAnalyzing(true)
        try {
            const { data } = await api.post("/flows/import/preview", { companyId, bundle })
            return {
                flowName: data.flowName,
                pendingExtensions: data.pendingExtensions ?? [],
                pendingCredentials: data.pendingCredentials ?? [],
                availableExtensions: data.availableExtensions ?? [],
                availableCredentials: data.availableCredentials ?? [],
            }
        } catch (err) {
            toast.error(apiError(err, "Erro ao analisar arquivo de flow"))
            return null
        } finally {
            setAnalyzing(false)
        }
    }

    const importFlow = async (
        bundle: FlowExportBundle,
        companyId: string,
        resolutions: FlowImportResolutions
    ): Promise<string | null> => {
        setImporting(true)
        const id = toast.loading("Importando flow...")
        try {
            const { data } = await api.post("/flows/import", { companyId, bundle, resolutions })
            toast.success("Flow importado", { id })
            await queryClient.invalidateQueries({ queryKey: ["flows"] })
            return data.flowId as string
        } catch (err) {
            toast.error(apiError(err, "Erro ao importar flow"), { id })
            return null
        } finally {
            setImporting(false)
        }
    }

    return { analyzing, importing, previewImport, importFlow }
}
