import { type Company } from "@/hooks/use-companies"
import { type TimeGroup, type TimeGroupForm } from "@/hooks/use-time-groups"

export type TimeGroupFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    timeGroup: TimeGroup | null
    companies: Company[]
    onSave: (form: TimeGroupForm) => Promise<boolean>
}

export type TimeGroupsTableProps = {
    timeGroups: TimeGroup[]
    companies: Company[]
    loading: boolean
    companySelected: boolean
    onEdit: (timeGroup: TimeGroup) => void
    onDelete: (timeGroup: TimeGroup) => void
}
