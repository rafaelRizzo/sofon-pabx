import { type DashboardInfra, type DashboardOverview } from "@/hooks/use-dashboard"

export type DashboardCallsByRegionMapProps = {
    companyId?: string
}

export type DashboardCallsComparisonChartProps = {
    overview: DashboardOverview | null
    loading: boolean
}

export type DashboardInfraCardsProps = {
    infra: DashboardInfra | null
    loading: boolean
}

export type DashboardOverviewCardsProps = {
    overview: DashboardOverview | null
    loading: boolean
}

export type DashboardRecentCallsProps = {
    companyId: string | undefined
}

export type DashboardTrunksStatusProps = {
    companyId: string | undefined
}
