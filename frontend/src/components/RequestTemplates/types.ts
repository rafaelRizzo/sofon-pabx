import { type Company } from "@/hooks/use-companies"
import {
    type RequestTemplate,
    type RequestTemplateForm,
} from "@/hooks/use-request-templates"

export type RequestTemplateFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    requestTemplate: RequestTemplate | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `requestTemplate` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: RequestTemplateForm) => Promise<boolean>
    onDelete?: () => void
}

export type RequestTemplatesTableProps = {
    requestTemplates: RequestTemplate[]
    loading: boolean
    companySelected: boolean
    onEdit: (requestTemplate: RequestTemplate) => void
    onDelete: (requestTemplate: RequestTemplate) => void
}
