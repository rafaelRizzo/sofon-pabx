"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

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
    const { data: regions = [], isLoading: loading } = useQuery({
        queryKey: ["dashboard-calls-by-region", companyId, filters],
        queryFn: async () => {
            const { data } = await api.get("/dashboard/calls-by-region", {
                params: {
                    companyId: companyId || undefined,
                    startDate: filters.startDate || undefined,
                    endDate: filters.endDate || undefined,
                    direction: filters.direction ?? "all",
                },
            })
            return (data.callsByRegion?.regions ?? []) as CallsByRegion[]
        },
    })

    return { regions, loading }
}
