import { type CdrMetrics, type CdrRecord } from "@/hooks/use-cdr"
import { type Trunk } from "@/hooks/use-trunks"

export type CdrMetricsCardsProps = {
    metrics: CdrMetrics | null
    loading: boolean
}

export type CdrRecordingDialogProps = {
    record: CdrRecord | null
    companyId: string
    onOpenChange: (open: boolean) => void
}

export type CdrTableProps = {
    records: CdrRecord[]
    trunks: Trunk[]
    loading: boolean
    companyId: string
}
