import { type AuditLog } from "@/hooks/use-audit-logs"
import type { Company } from "@/hooks/use-companies"

export type AuditLogDetailDialogProps = {
    log: AuditLog | null
    onOpenChange: (open: boolean) => void
}

export type AuditLogTableProps = {
    records: AuditLog[]
    companies: Company[]
    loading: boolean
    showCompanyColumn?: boolean
}
