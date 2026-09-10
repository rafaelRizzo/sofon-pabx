import { type Company } from "@/hooks/use-companies"
import { type Queue, type QueueForm } from "@/hooks/use-queues"

export type QueueFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    queue: Queue | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `queue` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: QueueForm) => Promise<boolean>
    onDelete?: () => void
    // abre o QueueMembersSheet - só passado por quem tem acesso à fila fora do fluxo normal da
    // página de filas (ex: EditNodeDialog, que edita a fila a partir do canvas de Flows e não tem
    // outro jeito de chegar no gerenciador de membros)
    onManageMembers?: () => void
}

export type QueueMembersSheetProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    queue: Queue | null
}

export type QueuesTableProps = {
    queues: Queue[]
    companies: Company[]
    loading: boolean
    companySelected: boolean
    onEdit: (queue: Queue) => void
    onManageMembers: (queue: Queue) => void
    onDelete: (queue: Queue) => void
}
