import { type Extension } from "@/hooks/use-extensions"
import { type Trunk } from "@/hooks/use-trunks"
import {
    type OutboundRoute,
    type OutboundRouteForm,
} from "@/hooks/use-outbound-routes"

export type ExtensionRestrictSelectProps = {
    extensions: Extension[]
    value: string[]
    onChange: (extensionIds: string[]) => void
    className?: string
}

export type OutboundRouteFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    route: OutboundRoute | null
    trunks: Trunk[]
    extensions: Extension[]
    // Todas as rotas da empresa (sem filtro de busca) - usadas só para checar padrão
    // duplicado em tempo real; a validação que vale mesmo é a do backend (409 no save)
    existingRoutes: OutboundRoute[]
    onSave: (form: OutboundRouteForm) => Promise<boolean>
}

export type OutboundRoutesTableProps = {
    routes: OutboundRoute[]
    trunks: Trunk[]
    loading: boolean
    companySelected: boolean
    onEdit: (route: OutboundRoute) => void
    onDelete: (route: OutboundRoute) => void
}

export type TrunkOrderSelectProps = {
    trunks: Trunk[]
    value: string[]
    onChange: (trunkIds: string[]) => void
    className?: string
}

export type SortableTrunkRowProps = {
    trunk: Trunk
    index: number
    onRemove: () => void
}
