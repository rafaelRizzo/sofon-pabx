"use client"

import { useEffect, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type CallRating = {
    id: string
    companyId: string
    extensionId: string
    number: string
    uniqueid: string | null
    // 1 linha por chamada - cada nota fica null até a respectiva pergunta ser respondida
    scoreAtendimento: number | null
    scoreServico: number | null
    createdAt: string
    // resolvido pelo backend em tempo de leitura (join solto por uniqueid com o CDR) - indica se
    // dá pra baixar a gravação da chamada vinculada a essa nota
    hasRecording: boolean
}

export type CallRatingFilters = {
    extensionId?: string
    number?: string
    // bate em scoreAtendimento OU scoreServico
    score?: number
    startDate?: string // YYYY-MM-DD
    endDate?: string // YYYY-MM-DD
    order?: "asc" | "desc"
}

// Espelha createRatingSchema de
// backend/src/modules/callcenter/ratings/schemas/call-rating.schema.ts
export const createCallRatingFormSchema = z.object({
    companyId: z.string().min(1, "Selecione uma empresa"),
    extensionId: z.string().min(1, "Selecione um ramal"),
    number: z
        .string()
        .min(1, "Informe o número")
        .max(80, "Máximo 80 caracteres"),
    uniqueid: z.string().max(150).optional(),
    score: z.coerce.number().int().min(1, "Mínimo 1").max(5, "Máximo 5"),
})

export type CallRatingForm = z.infer<typeof createCallRatingFormSchema>

const DEFAULT_LIMIT = 50

function filterParams(companyId: string, filters: CallRatingFilters, extra?: object) {
    return {
        companyId,
        extensionId: filters.extensionId || undefined,
        number: filters.number || undefined,
        score: filters.score || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        order: filters.order ?? "desc",
        ...extra,
    }
}

// companyId é obrigatório na query do backend - sem opção de "todas as empresas" aqui
export function useCallRatings(
    companyId?: string,
    filters: CallRatingFilters = {},
    limit = DEFAULT_LIMIT
) {
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)

    const { extensionId, number, score, startDate, endDate, order } = filters

    // qualquer mudança de filtro/empresa reseta a navegação para a 1ª página
    useEffect(() => {
        setPage(1)
    }, [companyId, extensionId, number, score, startDate, endDate, order])

    const queryKey = ["call-ratings", companyId, filters, page, limit]

    const { data, isLoading: loading } = useQuery({
        queryKey,
        queryFn: async () => {
            const { data } = await api.get("/callcenter/ratings", {
                params: filterParams(companyId as string, filters, { page, limit }),
            })
            return {
                ratings: (data.records ?? []) as CallRating[],
                total: (data.total ?? 0) as number,
            }
        },
        enabled: !!companyId,
        placeholderData: keepPreviousData,
    })

    const createRating = async (form: CallRatingForm) => {
        const id = toast.loading("Registrando nota...")
        try {
            await api.post("/callcenter/ratings", form)
            toast.success("Nota registrada", { id })
            await queryClient.invalidateQueries({ queryKey: ["call-ratings"] })
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao registrar nota"), { id })
            return false
        }
    }

    return {
        ratings: data?.ratings ?? [],
        total: data?.total ?? 0,
        limit,
        loading,
        page,
        totalPages: Math.max(1, Math.ceil((data?.total ?? 0) / limit)),
        goToPage: setPage,
        createRating,
    }
}

// Streaming CSV do backend (/callcenter/ratings/export) - sem limite de linhas, mesmo padrão de
// downloadCdrExport (use-cdr.ts)
export async function downloadCallRatingsExport(companyId: string, filters: CallRatingFilters = {}) {
    const res = await api.get("/callcenter/ratings/export", {
        params: filterParams(companyId, filters),
        responseType: "blob",
    })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "notas-de-atendimento.csv"
    a.click()
    URL.revokeObjectURL(url)
}

function extractFilename(disposition: unknown, fallback: string): string {
    if (typeof disposition !== "string") return fallback
    const match = disposition.match(/filename="?([^"]+)"?/)
    return match?.[1] ?? fallback
}

// Baixa a gravação da chamada vinculada à nota (/callcenter/ratings/:id/recording) - backend
// resolve o CDR pelo uniqueid solto (sem FK), mesmo padrão de downloadCdrRecording (use-cdr.ts)
export async function downloadCallRatingRecording(id: string, companyId: string) {
    const toastId = toast.loading("Baixando gravação...")
    try {
        const res = await api.get(`/callcenter/ratings/${id}/recording`, {
            params: { companyId },
            responseType: "blob",
        })
        const filename = extractFilename(res.headers["content-disposition"], `nota-${id}.wav`)
        const url = URL.createObjectURL(res.data as Blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Gravação baixada", { id: toastId })
    } catch (err) {
        toast.error(apiError(err, "Erro ao baixar gravação"), { id: toastId })
    }
}
