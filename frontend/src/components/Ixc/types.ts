import { type Company } from "@/hooks/use-companies"
import { type IxcNode, type IxcNodeForm } from "@/hooks/use-ixc-nodes"

export type IxcNodeFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    ixcNode: IxcNode | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `ixcNode` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: IxcNodeForm) => Promise<boolean>
    onDelete?: () => void
}

export type IxcResponseTreeProps = {
    data: unknown
    onPick: (path: string, key: string) => void | Promise<void>
}
