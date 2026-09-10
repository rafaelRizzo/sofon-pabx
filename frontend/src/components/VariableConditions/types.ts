import { type Company } from "@/hooks/use-companies"
import {
    type VariableCondition,
    type VariableConditionForm,
} from "@/hooks/use-variable-conditions"

export type VariableConditionFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    variableCondition: VariableCondition | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `variableCondition` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: VariableConditionForm) => Promise<boolean>
    onDelete?: () => void
}

export type VariableConditionsTableProps = {
    variableConditions: VariableCondition[]
    loading: boolean
    companySelected: boolean
    onEdit: (variableCondition: VariableCondition) => void
    onDelete: (variableCondition: VariableCondition) => void
}

export type VariableRefPickerButtonProps = {
    companyId: string
    onSelect: (variable: string) => void
    className?: string
}
