import { type Company } from "@/hooks/use-companies"
import {
    type Extension,
    type ExtensionCreateForm,
    type ExtensionUpdateForm,
} from "@/hooks/use-extensions"

export type ExtensionFormDialogProps =
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          extension: null
          companies: Company[]
          onCreate: (form: ExtensionCreateForm) => Promise<any>
          onUpdate?: never
      }
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          extension: Extension | string
          companies: Company[]
          onCreate?: never
          onUpdate: (form: ExtensionUpdateForm) => Promise<boolean>
      }

export type ExtensionsTableProps = {
    extensions: Extension[]
    companies: Company[]
    loading: boolean
    companySelected: boolean
    onEdit: (extension: Extension) => void
    onResetPassword: (extension: Extension) => void
    onDelete: (extension: Extension) => void
}
