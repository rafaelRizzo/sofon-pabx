import type { CallQualityRecord, CallQualitySummary } from "@/hooks/use-call-quality"

export type CallQualitySummaryCardsProps = {
    summary: CallQualitySummary | null
    loading: boolean
}

export type CallQualityTableProps = {
    records: CallQualityRecord[]
    loading: boolean
}
