"use client"

import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

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
    const [page, setPage] = useState(1)
    const { trunkId, startDate, endDate, order } = filters

    // qualquer mudança de filtro/empresa reseta a navegação para a 1ª página
    useEffect(() => {
        setPage(1)
    }, [companyId, trunkId, startDate, endDate, order])

    const { data, isLoading: loading } = useQuery({
        queryKey: ["call-quality", companyId, filters, page, limit],
        queryFn: async () => {
            const { data } = await api.get("/call-quality", {
                params: filterParams(companyId as string, filters, { page, limit }),
            })
            return {
                records: (data.records ?? []) as CallQualityRecord[],
                total: (data.total ?? 0) as number,
            }
        },
        enabled: !!companyId,
        placeholderData: keepPreviousData,
    })

    return {
        records: data?.records ?? [],
        total: data?.total ?? 0,
        limit,
        loading,
        page,
        totalPages: Math.max(1, Math.ceil((data?.total ?? 0) / limit)),
        goToPage: setPage,
    }
}

export function useCallQualitySummary(companyId?: string, filters: CallQualityFilters = {}) {
    const { data: summary = null, isLoading: loading } = useQuery({
        queryKey: ["call-quality-summary", companyId, filters],
        queryFn: async () => {
            const { data } = await api.get("/call-quality/summary", {
                params: filterParams(companyId as string, filters),
            })
            return (data.summary ?? null) as CallQualitySummary | null
        },
        enabled: !!companyId,
    })

    return { summary, loading }
}
