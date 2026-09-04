"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type CallsByRegionDirection = "all" | "inbound" | "outbound"

export type CallsByRegionFilters = {
    startDate?: string // YYYY-MM-DD
    endDate?: string // YYYY-MM-DD
    direction?: CallsByRegionDirection
}

// Espelha backend/src/modules/dashboard/schemas/dashboard.schema.ts (DashboardCallsByRegionSchema)
export type CallsByRegion = {
    uf: string
    calls: number
    byDdd: { ddd: string; calls: number }[]
}

export function useDashboardCallsByRegion(
    companyId: string | undefined,
    filters: CallsByRegionFilters
) {
    const [regions, setRegions] = useState<CallsByRegion[]>([])
    const [loading, setLoading] = useState(true)

    const fetchCallsByRegion = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/dashboard/calls-by-region", {
                params: {
                    companyId: companyId || undefined,
                    startDate: filters.startDate || undefined,
                    endDate: filters.endDate || undefined,
                    direction: filters.direction ?? "all",
                },
            })
            setRegions(data.callsByRegion?.regions ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar chamadas por região"))
        } finally {
            setLoading(false)
        }
    }, [companyId, filters.startDate, filters.endDate, filters.direction])

    useEffect(() => {
        fetchCallsByRegion()
    }, [fetchCallsByRegion])

    return { regions, loading }
}
