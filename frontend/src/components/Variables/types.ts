import { type Company } from "@/hooks/use-companies"
import { type VariableSet, type VariableSetForm } from "@/hooks/use-variables"

export type VariableSetFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    variableSet: VariableSet | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `variableSet` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: VariableSetForm) => Promise<boolean>
    onDelete?: () => void
}

export type VariableSetsTableProps = {
    variableSets: VariableSet[]
    loading: boolean
    companySelected: boolean
    onEdit: (variableSet: VariableSet) => void
    onDelete: (variableSet: VariableSet) => void
}
