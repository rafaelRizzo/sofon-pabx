"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

// Espelha backend/src/modules/dashboard/schemas/dashboard.schema.ts
export type DashboardOverview = {
    extensionsOnline: number
    extensionsOffline: number
    callsToday: number
    callsThisMonth: number
    callsThisYear: number
}

export type DashboardInfra = {
    cpu: { loadAvg1: number; loadAvg5: number; loadAvg15: number; cores: number }
    memory: { totalBytes: number; freeBytes: number; usedPct: number }
    disk: { totalBytes: number; usedBytes: number; freeBytes: number; usedPct: number }
    recordings: { sizeBytes: number }
    logs: { sizeBytes: number }
}

// Poll simples (não SSE) - esse dado não é orientado a evento AMI, não faz sentido plugar no
// realtime-bus (ver backend/src/asterisk/transport/realtime-bus.ts)
const OVERVIEW_POLL_MS = 20_000
const INFRA_POLL_MS = 30_000

export function useDashboardOverview(companyId?: string) {
    const [overview, setOverview] = useState<DashboardOverview | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchOverview = useCallback(async () => {
        try {
            const { data } = await api.get("/dashboard/overview", {
                params: companyId ? { companyId } : undefined,
            })
            setOverview(data.overview ?? null)
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar visão geral"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    useEffect(() => {
        setLoading(true)
        fetchOverview()
        const interval = setInterval(fetchOverview, OVERVIEW_POLL_MS)
        return () => clearInterval(interval)
    }, [fetchOverview])

    return { overview, loading }
}

// Admin-only no backend (requireAdmin) - chamador decide se chama baseado em useAuth().user?.role
export function useDashboardInfra(enabled: boolean) {
    const [infra, setInfra] = useState<DashboardInfra | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchInfra = useCallback(async () => {
        if (!enabled) {
            setInfra(null)
            setLoading(false)
            return
        }
        try {
            const { data } = await api.get("/dashboard/infra")
            setInfra(data.infra ?? null)
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar saúde da infraestrutura"))
        } finally {
            setLoading(false)
        }
    }, [enabled])

    useEffect(() => {
        setLoading(true)
        fetchInfra()
        if (!enabled) return
        const interval = setInterval(fetchInfra, INFRA_POLL_MS)
        return () => clearInterval(interval)
    }, [fetchInfra, enabled])

    return { infra, loading }
}
