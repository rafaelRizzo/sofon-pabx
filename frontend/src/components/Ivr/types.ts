import { type Company } from "@/hooks/use-companies"
import { type IvrMenu, type IvrMenuForm } from "@/hooks/use-ivr"

export type IvrMenuFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    ivrMenu: IvrMenu | null
    companies: Company[]
    defaultCompanyId?: string
    flowNodeMode?: boolean
    onSave: (form: IvrMenuForm) => Promise<boolean>
    onDelete?: () => void
}

export type IvrMenusTableProps = {
    ivrMenus: IvrMenu[]
    loading: boolean
    companySelected: boolean
    onEdit: (ivrMenu: IvrMenu) => void
    onDelete: (ivrMenu: IvrMenu) => void
}
