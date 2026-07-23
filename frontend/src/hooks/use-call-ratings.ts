"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type CallRating = {
    id: string
    companyId: string
    extensionId: string
    number: string
    uniqueid: string | null
    score: number
    createdAt: string
}

export type CallRatingFilters = {
    extensionId?: string
    number?: string
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

// companyId é obrigatório na query do backend — sem opção de "todas as empresas" aqui
export function useCallRatings(
    companyId?: string,
    filters: CallRatingFilters = {}
) {
    const [ratings, setRatings] = useState<CallRating[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)

    const { extensionId, number, score, startDate, endDate, order } = filters

    const fetchRatings = useCallback(async () => {
        if (!companyId) {
            setRatings([])
            setTotal(0)
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/callcenter/ratings", {
                params: {
                    companyId,
                    extensionId: extensionId || undefined,
                    number: number || undefined,
                    score: score || undefined,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    limit: DEFAULT_LIMIT,
                    order: order ?? "desc",
                },
            })
            setRatings(data.records ?? [])
            setTotal(data.total ?? 0)
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar notas de atendimento"))
        } finally {
            setLoading(false)
        }
    }, [companyId, extensionId, number, score, startDate, endDate, order])

    const createRating = async (form: CallRatingForm) => {
        const id = toast.loading("Registrando nota...")
        try {
            await api.post("/callcenter/ratings", form)
            toast.success("Nota registrada", { id })
            await fetchRatings()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao registrar nota"), { id })
            return false
        }
    }

    useEffect(() => {
        fetchRatings()
    }, [fetchRatings])

    return {
        ratings,
        total,
        loading,
        fetchRatings,
        createRating,
    }
}
