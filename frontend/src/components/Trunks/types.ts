import { type Company } from "@/hooks/use-companies"
import { type RealtimeTrunk } from "@/hooks/use-realtime"
import {
    type Trunk,
    type TrunkCreateForm,
    type TrunkUpdateForm,
} from "@/hooks/use-trunks"

export type TrunkFormDialogProps =
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          trunk: null
          companies: Company[]
          onCreate: (form: TrunkCreateForm) => Promise<Trunk | null>
          onUpdate?: never
      }
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          trunk: Trunk
          companies: Company[]
          onCreate?: never
          onUpdate: (form: TrunkUpdateForm) => Promise<boolean>
      }

export type TrunksTableProps = {
    trunks: Trunk[]
    realtimeTrunks: RealtimeTrunk[]
    loading: boolean
    companySelected: boolean
    onEdit: (trunk: Trunk) => void
    onDelete: (trunk: Trunk) => void
    onToggleActive: (trunk: Trunk, active: boolean) => void
}
