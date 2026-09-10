import { type Company } from "@/hooks/use-companies"
import {
    type IntegrationCredential,
    type IntegrationCredentialForm,
} from "@/hooks/use-integration-credentials"

export type IntegrationCredentialFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    integrationCredential: IntegrationCredential | null
    companies: Company[]
    onSave: (form: IntegrationCredentialForm) => Promise<boolean>
    onDelete?: () => void
}

export type IntegrationCredentialsTableProps = {
    integrationCredentials: IntegrationCredential[]
    loading: boolean
    companySelected: boolean
    onEdit: (integrationCredential: IntegrationCredential) => void
    onDelete: (integrationCredential: IntegrationCredential) => void
}
