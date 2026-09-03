"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type ImportResult = {
    created: number
    warnings: string[]
}

export type ImportIssabelSummary = {
    extensions: ImportResult
    trunks: ImportResult
    queues: ImportResult
    queueMembers: ImportResult & { skippedAgents: number }
}

async function importIssabelRequest(companyId: string, file: File) {
    const form = new FormData()
    form.append("file", file)
    const { data } = await api.post(
        `/companies/${companyId}/migrations/issabel`,
        form
    )
    return data.summary as ImportIssabelSummary
}

export function useIssabelImport() {
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: ({
            companyId,
            file,
        }: {
            companyId: string
            file: File
        }) => importIssabelRequest(companyId, file),
    })

    const importIssabelBackup = async (companyId: string, file: File) => {
        const id = toast.loading("Importando backup do Issabel...")
        try {
            const summary = await mutation.mutateAsync({ companyId, file })
            toast.success("Import concluído", { id })
            // ramais/filas/troncos importados aparecem nas listagens das outras telas
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["extensions"] }),
                queryClient.invalidateQueries({ queryKey: ["queues"] }),
                queryClient.invalidateQueries({ queryKey: ["trunks"] }),
            ])
            return summary
        } catch (err) {
            toast.error(apiError(err, "Erro ao importar backup"), { id })
            return null
        }
    }

    return {
        importIssabelBackup,
        importing: mutation.isPending,
    }
}
