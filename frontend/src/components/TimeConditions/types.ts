import { type Company } from "@/hooks/use-companies"
import {
    type TimeCondition,
    type TimeConditionForm,
} from "@/hooks/use-time-conditions"

export type TimeConditionFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    timeCondition: TimeCondition | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `timeCondition` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: TimeConditionForm) => Promise<boolean>
    onDelete?: () => void
}

export type TimeConditionsTableProps = {
    timeConditions: TimeCondition[]
    loading: boolean
    companySelected: boolean
    onEdit: (timeCondition: TimeCondition) => void
    onDelete: (timeCondition: TimeCondition) => void
}
