"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

// Espelha backend/src/modules/call-quality/schemas/call-quality.schema.ts
export type CallQualityRecord = {
    id: string
    trunkId: string
    trunkName: string | null
    uniqueid: string
    linkedid: string | null
    callerNum: string | null
    channel: string
    startAt: string
    endAt: string
    avgRxJitterUnits: number | null
    avgRxLostPct: number | null
    rxSamples: number
    avgTxJitterUnits: number | null
    avgTxLostPct: number | null
    txSamples: number
    avgRttSeconds: number | null
    rttSamples: number
}

export type CallQualitySummary = {
    totalCalls: number
    avgRxJitterUnits: number | null
    avgRxLostPct: number | null
    avgTxJitterUnits: number | null
    avgTxLostPct: number | null
    avgRttSeconds: number | null
}

export type CallQualityFilters = {
    trunkId?: string
    startDate?: string // YYYY-MM-DD
    endDate?: string // YYYY-MM-DD
    order?: "asc" | "desc"
}

const DEFAULT_LIMIT = 50

function filterParams(companyId: string, filters: CallQualityFilters, extra?: object) {
    return {
        companyId,
        trunkId: filters.trunkId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        order: filters.order ?? "desc",
        ...extra,
    }
}

export function useCallQualityRecords(
    companyId?: string,
    filters: CallQualityFilters = {},
    limit = DEFAULT_LIMIT
) {
    const [records, setRecords] = useState<CallQualityRecord[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)

    const { trunkId, startDate, endDate, order } = filters

    const fetchPage = useCallback(
        async (targetPage: number) => {
            if (!companyId) {
                setRecords([])
                setTotal(0)
                setLoading(false)
                return
            }
            setLoading(true)
            try {
                const { data } = await api.get("/call-quality", {
                    params: filterParams(companyId, filters, { page: targetPage, limit }),
                })
                setRecords(data.records ?? [])
                setTotal(data.total ?? 0)
            } catch (err) {
                toast.error(apiError(err, "Erro ao buscar qualidade de rede"))
            } finally {
                setLoading(false)
            }
        },
        // filters é recriado a cada render do caller - usar os campos primitivos como deps reais
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [companyId, limit, trunkId, startDate, endDate, order]
    )

    useEffect(() => {
        setPage(1)
        fetchPage(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchPage])

    const goToPage = (targetPage: number) => {
        setPage(targetPage)
        fetchPage(targetPage)
    }

    return {
        records,
        total,
        limit,
        loading,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        goToPage,
    }
}

export function useCallQualitySummary(companyId?: string, filters: CallQualityFilters = {}) {
    const [summary, setSummary] = useState<CallQualitySummary | null>(null)
    const [loading, setLoading] = useState(true)

    const { trunkId, startDate, endDate } = filters

    const fetchSummary = useCallback(async () => {
        if (!companyId) {
            setSummary(null)
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/call-quality/summary", {
                params: filterParams(companyId, filters),
            })
            setSummary(data.summary ?? null)
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar média de qualidade de rede"))
        } finally {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId, trunkId, startDate, endDate])

    useEffect(() => {
        fetchSummary()
    }, [fetchSummary])

    return { summary, loading }
}
