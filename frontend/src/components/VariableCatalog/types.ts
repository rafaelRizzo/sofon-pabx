import { type Company } from "@/hooks/use-companies"
import { type Variable, type VariableForm } from "@/hooks/use-variable-catalog"

export type VariableCatalogFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    variable: Variable | null
    companies: Company[]
    defaultCompanyId?: string
    onSave: (form: VariableForm) => Promise<boolean>
}

export type VariableCatalogTableProps = {
    variables: Variable[]
    companies: Company[]
    loading: boolean
    companySelected: boolean
    onEdit: (variable: Variable) => void
    onDelete: (variable: Variable) => void
}
