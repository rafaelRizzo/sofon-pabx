"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

// Espelha backend/src/modules/dashboard/schemas/dashboard.schema.ts
export type DashboardOverview = {
    extensionsOnline: number
    extensionsOffline: number
    callsToday: number
    callsYesterday: number
    callsThisMonth: number
    callsThisYear: number
}

export type DashboardInfra = {
    uptimeSeconds: number
    network: { rxBytesPerSec: number; txBytesPerSec: number }
    cpu: {
        loadAvg1: number
        loadAvg5: number
        loadAvg15: number
        cores: number
        perCoreUsedPct: number[]
    }
    memory: { totalBytes: number; freeBytes: number; usedPct: number }
    swap: { totalBytes: number; freeBytes: number; usedPct: number }
    disk: { totalBytes: number; usedBytes: number; freeBytes: number; usedPct: number }
    recordings: { sizeBytes: number }
    logs: { sizeBytes: number }
}

// Poll simples (não SSE) - esse dado não é orientado a evento AMI, não faz sentido plugar no
// realtime-bus (ver backend/src/asterisk/transport/realtime-bus.ts)
const OVERVIEW_POLL_MS = 20_000
const INFRA_POLL_MS = 30_000

export function useDashboardOverview(companyId?: string) {
    const { data: overview = null, isLoading: loading } = useQuery({
        queryKey: ["dashboard-overview", companyId],
        queryFn: async () => {
            const { data } = await api.get("/dashboard/overview", {
                params: companyId ? { companyId } : undefined,
            })
            return (data.overview ?? null) as DashboardOverview | null
        },
        refetchInterval: OVERVIEW_POLL_MS,
    })

    return { overview, loading }
}

// Admin-only no backend (requireAdmin) - chamador decide se chama baseado em useAuth().user?.role
export function useDashboardInfra(enabled: boolean) {
    const { data: infra = null, isLoading: loading } = useQuery({
        queryKey: ["dashboard-infra"],
        queryFn: async () => {
            const { data } = await api.get("/dashboard/infra")
            return (data.infra ?? null) as DashboardInfra | null
        },
        enabled,
        refetchInterval: INFRA_POLL_MS,
    })

    return { infra, loading }
}
