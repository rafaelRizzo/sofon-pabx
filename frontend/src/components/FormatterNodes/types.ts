import { type Company } from "@/hooks/use-companies"
import { type FormatterNode, type FormatterNodeForm } from "@/hooks/use-formatter-nodes"

export type FormatterNodeFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    formatterNode: FormatterNode | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `formatterNode` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: FormatterNodeForm) => Promise<boolean>
    onDelete?: () => void
}
