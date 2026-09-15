import { type Company } from "@/hooks/use-companies"
import {
    type Did,
    type DidCreateForm,
    type DidUpdateForm,
} from "@/hooks/use-dids"

export type DidFormDialogProps =
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          did: null
          companies: Company[]
          onCreate: (form: DidCreateForm) => Promise<boolean>
          onUpdate?: never
      }
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          did: Did
          companies: Company[]
          onCreate?: never
          onUpdate: (form: DidUpdateForm) => Promise<boolean>
      }

export type DidsTableProps = {
    dids: Did[]
    companies: Company[]
    loading: boolean
    onEdit?: (did: Did) => void
    onDelete?: (did: Did) => void
}
