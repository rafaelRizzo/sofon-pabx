import { type Did } from "@/hooks/use-dids"
import { type InboundRoute, type InboundRouteForm } from "@/hooks/use-inbound-routes"
import { type Trunk } from "@/hooks/use-trunks"

export type InboundRouteFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    route: InboundRoute | null
    companyId: string
    dids: Did[]
    trunks: Trunk[]
    // Todas as rotas da empresa - usadas só pra avisar em tempo real sobre combinação
    // DID + tronco duplicada; a validação que vale é o 409 do backend
    existingRoutes: InboundRoute[]
    onSave: (form: InboundRouteForm) => Promise<boolean>
}

export type InboundRoutesTableProps = {
    routes: InboundRoute[]
    loading: boolean
    companySelected: boolean
    onEdit: (route: InboundRoute) => void
    onDelete: (route: InboundRoute) => void
}
