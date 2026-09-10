import { type Company, type CompanyForm } from "@/hooks/use-companies"

export type CompaniesTableProps = {
    companies: Company[]
    loading: boolean
    onEdit: (company: Company) => void
    onDelete: (company: Company) => void
    onResyncDialplan: (company: Company) => void
    onImportIssabel: (company: Company) => void
}

export type CompanyFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    company: Company | null
    onSave: (form: CompanyForm) => Promise<boolean>
}

export type ImportIssabelDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    companyName: string
}
