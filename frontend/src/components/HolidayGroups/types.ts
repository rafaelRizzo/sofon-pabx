import { type Company } from "@/hooks/use-companies"
import { type HolidayGroup, type HolidayGroupForm } from "@/hooks/use-holiday-groups"

export type HolidayGroupFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    holidayGroup: HolidayGroup | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `holidayGroup` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: HolidayGroupForm) => Promise<boolean>
    onDelete?: () => void
}

export type HolidayGroupsTableProps = {
    holidayGroups: HolidayGroup[]
    loading: boolean
    companySelected: boolean
    onEdit: (holidayGroup: HolidayGroup) => void
    onDelete: (holidayGroup: HolidayGroup) => void
}
